//! Kiosk helpers: Wi-Fi, power, GitHub version list for the Pi panel.

use std::collections::BTreeMap;
use std::process::{Command, Stdio};

#[derive(Clone, Default)]
pub struct WifiStatus {
    pub ssid: String,
    pub ip: String,
    pub state: String,
}

#[derive(Clone)]
pub struct WifiNet {
    pub ssid: String,
    pub signal: i32,
    pub secured: bool,
}

#[derive(Clone)]
pub struct VersionRow {
    pub tag: String,
    pub name: String,
    pub current: bool,
    pub installable: bool,
}

fn sudo(bin: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("sudo")
        .arg("-n")
        .arg(bin)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("Could not run {bin}: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() { stdout } else { stderr };
        return Err(if msg.is_empty() {
            format!("{bin} failed")
        } else {
            msg
        });
    }
    Ok(stdout)
}

/// Global IPv4 addresses (ethernet + wifi), no sudo.
pub fn lan_addrs() -> String {
    let out = Command::new("hostname").arg("-I").output().ok();
    if let Some(out) = out {
        let ips: Vec<String> = String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .filter(|a| a.contains('.') && !a.starts_with("127."))
            .map(|a| a.to_string())
            .collect();
        if !ips.is_empty() {
            return ips.join("  ");
        }
    }
    let out = Command::new("ip")
        .args(["-4", "-o", "addr", "show", "scope", "global"])
        .output()
        .ok();
    if let Some(out) = out {
        let mut ips = Vec::new();
        for line in String::from_utf8_lossy(&out.stdout).lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let ip = parts[3].split('/').next().unwrap_or("");
                if !ip.is_empty() && !ip.starts_with("127.") {
                    ips.push(format!("{} {}", parts[1], ip));
                }
            }
        }
        if !ips.is_empty() {
            return ips.join("  ");
        }
    }
    "NO IP".into()
}

pub fn wifi_status() -> WifiStatus {
    match sudo("/usr/lib/judie/wifi", &["status"]) {
        Ok(line) => {
            let mut p = line.split('\t');
            WifiStatus {
                ssid: p.next().unwrap_or("—").into(),
                ip: p.next().unwrap_or("—").into(),
                state: p.next().unwrap_or("—").into(),
            }
        }
        Err(_) => WifiStatus {
            ssid: "—".into(),
            ip: "—".into(),
            state: "offline".into(),
        },
    }
}

pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    let out = sudo("/usr/lib/judie/wifi", &["scan"])?;
    let mut by_ssid: BTreeMap<String, WifiNet> = BTreeMap::new();
    for line in out.lines() {
        let mut p = line.split('\t');
        let ssid = p.next().unwrap_or("").trim();
        if ssid.is_empty() || ssid == "--" {
            continue;
        }
        let signal = p.next().and_then(|s| s.parse().ok()).unwrap_or(0);
        let secured = p.next().unwrap_or("open") != "open";
        by_ssid
            .entry(ssid.to_string())
            .and_modify(|n| {
                if signal > n.signal {
                    n.signal = signal;
                    n.secured = secured;
                }
            })
            .or_insert(WifiNet {
                ssid: ssid.to_string(),
                signal,
                secured,
            });
    }
    let mut nets: Vec<WifiNet> = by_ssid.into_values().collect();
    nets.sort_by(|a, b| b.signal.cmp(&a.signal));
    nets.truncate(16);
    Ok(nets)
}

pub fn wifi_connect(ssid: &str, pass: &str) -> Result<(), String> {
    let ssid = ssid.trim();
    if ssid.is_empty() {
        return Err("Pick a network first".into());
    }
    if pass.is_empty() {
        sudo("/usr/lib/judie/wifi", &["connect", ssid]).map(|_| ())
    } else {
        sudo("/usr/lib/judie/wifi", &["connect", ssid, pass]).map(|_| ())
    }
}

pub fn wifi_disconnect() -> Result<(), String> {
    sudo("/usr/lib/judie/wifi", &["disconnect"]).map(|_| ())
}

pub fn power(action: &str) -> Result<(), String> {
    match action {
        "reboot" | "poweroff" => sudo("/usr/lib/judie/power", &[action]).map(|_| ()),
        _ => Err("Unknown power action".into()),
    }
}

pub fn version_rows() -> Result<Vec<VersionRow>, String> {
    Ok(crate::releases::list_releases()?
        .into_iter()
        .take(12)
        .map(|r| VersionRow {
            tag: r.tag,
            name: r.name,
            current: r.current,
            installable: r.installable,
        })
        .collect())
}
