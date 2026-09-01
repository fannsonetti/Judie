//! Kiosk helpers: Wi-Fi, power, GitHub version list for the Pi panel.

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};

#[derive(Clone, Default)]
#[allow(dead_code)]
pub struct WifiStatus {
    pub ssid: String,
    pub ip: String,
    pub state: String,
}

#[derive(Clone)]
pub struct WifiNet {
    pub ssid: String,
    pub signal: i32,
    pub bars: i32,
    pub secured: bool,
    pub saved: bool,
    pub connected: bool,
}

#[derive(Clone, Default)]
pub struct LinkStatus {
    pub kind: String,
    pub ssid: String,
    pub bars: i32,
    pub state: String,
    pub ip: String,
}

#[derive(Clone)]
pub struct VersionRow {
    pub tag: String,
    pub name: String,
    pub current: bool,
    pub installable: bool,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
struct WifiMemory {
    #[serde(default)]
    passwords: BTreeMap<String, String>,
    #[serde(default)]
    autoconnect: BTreeMap<String, bool>,
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

fn memory_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/fannsonetti".into());
    PathBuf::from(home).join(".local/share/judie/wifi.json")
}

fn load_memory() -> WifiMemory {
    fs::read_to_string(memory_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_memory(mem: &WifiMemory) {
    if let Some(dir) = memory_path().parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(mem) {
        let _ = fs::write(memory_path(), json);
    }
}

fn bars_from_signal(signal: i32) -> i32 {
    if signal >= 80 {
        4
    } else if signal >= 55 {
        3
    } else if signal >= 30 {
        2
    } else if signal >= 1 {
        1
    } else {
        0
    }
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

pub fn link_status() -> LinkStatus {
    match sudo("/usr/lib/judie/wifi", &["link"]) {
        Ok(line) => {
            let mut p = line.split('\t');
            LinkStatus {
                kind: p.next().unwrap_or("wifi").into(),
                ssid: p.next().unwrap_or("—").into(),
                bars: p.next().and_then(|s| s.parse().ok()).unwrap_or(0),
                state: p.next().unwrap_or("down").into(),
                ip: p.next().unwrap_or("—").into(),
            }
        }
        Err(_) => LinkStatus {
            kind: "wifi".into(),
            ssid: "—".into(),
            bars: 0,
            state: "down".into(),
            ip: "—".into(),
        },
    }
}

pub fn preferred_iface() -> String {
    sudo("/usr/lib/judie/wifi", &["preferred"]).unwrap_or_else(|_| "wifi".into())
}

pub fn set_preferred_iface(kind: &str) -> Result<(), String> {
    sudo("/usr/lib/judie/wifi", &["preferred", kind]).map(|_| ())
}

pub fn dhcp_enabled() -> bool {
    sudo("/usr/lib/judie/wifi", &["dhcp"])
        .map(|s| s.trim() == "on")
        .unwrap_or(true)
}

pub fn set_dhcp(on: bool) -> Result<(), String> {
    sudo("/usr/lib/judie/wifi", &["dhcp", if on { "on" } else { "off" }]).map(|_| ())
}

pub fn reconnect() -> Result<(), String> {
    sudo("/usr/lib/judie/wifi", &["reconnect"]).map(|_| ())
}

fn saved_names() -> BTreeMap<String, bool> {
    let mut map = BTreeMap::new();
    if let Ok(out) = sudo("/usr/lib/judie/wifi", &["saved"]) {
        for line in out.lines() {
            let mut p = line.split('\t');
            let name = p.next().unwrap_or("").trim();
            if name.is_empty() {
                continue;
            }
            let auto = p.next().unwrap_or("") == "auto";
            map.insert(name.to_string(), auto);
        }
    }
    let mem = load_memory();
    for (ssid, auto) in mem.autoconnect {
        map.entry(ssid).or_insert(auto);
    }
    map
}

pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    let out = sudo("/usr/lib/judie/wifi", &["scan"])?;
    let current = wifi_status().ssid;
    let saved = saved_names();
    let mut by_ssid: BTreeMap<String, WifiNet> = BTreeMap::new();
    for line in out.lines() {
        let mut p = line.split('\t');
        let ssid = p.next().unwrap_or("").trim();
        if ssid.is_empty() || ssid == "--" {
            continue;
        }
        let signal = p.next().and_then(|s| s.parse().ok()).unwrap_or(0);
        let secured = p.next().unwrap_or("open") != "open";
        let bars = bars_from_signal(signal);
        by_ssid
            .entry(ssid.to_string())
            .and_modify(|n| {
                if signal > n.signal {
                    n.signal = signal;
                    n.bars = bars;
                    n.secured = secured;
                }
            })
            .or_insert(WifiNet {
                ssid: ssid.to_string(),
                signal,
                bars,
                secured,
                saved: saved.contains_key(ssid),
                connected: ssid == current,
            });
    }
    let mut nets: Vec<WifiNet> = by_ssid.into_values().collect();
    nets.sort_by(|a, b| {
        b.connected
            .cmp(&a.connected)
            .then(b.saved.cmp(&a.saved))
            .then(b.signal.cmp(&a.signal))
    });
    nets.truncate(24);
    Ok(nets)
}

pub fn remembered_password(ssid: &str) -> Option<String> {
    let mem = load_memory();
    mem.passwords.get(ssid).cloned().filter(|s| !s.is_empty())
}

pub fn wants_autoconnect(ssid: &str) -> bool {
    load_memory()
        .autoconnect
        .get(ssid)
        .copied()
        .unwrap_or(true)
}

pub fn wifi_connect(ssid: &str, pass: &str, auto: bool) -> Result<(), String> {
    let ssid = ssid.trim();
    if ssid.is_empty() {
        return Err("Pick a network first".into());
    }
    let mut psk = pass.to_string();
    if psk.is_empty() {
        if let Some(saved) = remembered_password(ssid) {
            psk = saved;
        }
    }
    let auto_flag = if auto { "auto" } else { "off" };
    let result = if psk.is_empty() {
        sudo("/usr/lib/judie/wifi", &["connect", ssid, "", auto_flag]).map(|_| ())
    } else {
        sudo(
            "/usr/lib/judie/wifi",
            &["connect", ssid, &psk, auto_flag],
        )
        .map(|_| ())
    };
    if result.is_ok() {
        let mut mem = load_memory();
        if !psk.is_empty() {
            mem.passwords.insert(ssid.to_string(), psk);
        }
        mem.autoconnect.insert(ssid.to_string(), auto);
        save_memory(&mem);
        let _ = sudo(
            "/usr/lib/judie/wifi",
            &["autoconnect", ssid, if auto { "on" } else { "off" }],
        );
    }
    result
}

pub fn wifi_disconnect() -> Result<(), String> {
    sudo("/usr/lib/judie/wifi", &["disconnect"]).map(|_| ())
}

/// Only the kiosk helper verbs. The frontend cannot pass a shell command.
pub fn allowed_power_action(action: &str) -> Result<&'static str, String> {
    match action {
        "reboot" => Ok("reboot"),
        "poweroff" | "shutdown" => Ok("poweroff"),
        "uninstall" => Ok("uninstall"),
        _ => Err("Unknown power action".into()),
    }
}

pub fn power_mock_path() -> Option<String> {
    match std::env::var("JUDIE_POWER_MOCK") {
        Ok(path) if !path.is_empty() => Some(path),
        _ => None,
    }
}

pub fn uninstall_warning() -> &'static str {
    "This removes the Judie application, kiosk helpers, and autostart from this Raspberry Pi.\n\nKept on this computer:\n• Room settings, widgets, and routines (~/.local/share/judie)\n• Saved Wi-Fi networks\n\nThe panel stays on screen until uninstall finishes, then it reboots to the normal login screen."
}

pub fn power_status_label(action: &str) -> &'static str {
    match action {
        "reboot" => "Restarting the panel…",
        "poweroff" => "Shutting down…",
        "uninstall" => "Removing Judie. Settings stay on this computer…",
        _ => "Working…",
    }
}

pub fn power(action: &str) -> Result<(), String> {
    let action = allowed_power_action(action)?;
    if let Some(path) = power_mock_path() {
        std::fs::write(&path, action).map_err(|e| format!("Could not write power mock: {e}"))?;
        return Ok(());
    }
    sudo("/usr/lib/judie/power", &[action]).map(|_| ())
}

pub fn version_rows() -> Result<Vec<VersionRow>, String> {
    Ok(crate::releases::list_releases()?
        .into_iter()
        .take(24)
        .map(|r| VersionRow {
            tag: r.tag,
            name: r.name,
            current: r.current,
            installable: r.installable,
        })
        .collect())
}

#[cfg(test)]
mod power_tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static MOCK_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn power_actions_are_narrow() {
        assert_eq!(allowed_power_action("reboot").unwrap(), "reboot");
        assert_eq!(allowed_power_action("poweroff").unwrap(), "poweroff");
        assert_eq!(allowed_power_action("shutdown").unwrap(), "poweroff");
        assert_eq!(allowed_power_action("uninstall").unwrap(), "uninstall");
        for bad in [
            "reboot; rm -rf /",
            "poweroff && reboot",
            "/bin/sh",
            "apt-get remove vim",
            "",
            "reboot\npoweroff",
        ] {
            assert!(allowed_power_action(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn mock_power_does_not_call_sudo() {
        let _guard = MOCK_LOCK.lock().unwrap();
        let path = std::env::temp_dir().join(format!(
            "judie-power-mock-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::env::set_var("JUDIE_POWER_MOCK", &path);
        power("reboot").expect("mock reboot");
        assert_eq!(std::fs::read_to_string(&path).unwrap().trim(), "reboot");
        power("shutdown").expect("mock shutdown");
        assert_eq!(std::fs::read_to_string(&path).unwrap().trim(), "poweroff");
        power("uninstall").expect("mock uninstall");
        assert_eq!(std::fs::read_to_string(&path).unwrap().trim(), "uninstall");
        let _ = std::fs::remove_file(&path);
        std::env::remove_var("JUDIE_POWER_MOCK");
    }

    #[test]
    fn uninstall_warning_names_removal_and_kept_data() {
        let text = uninstall_warning();
        assert!(text.contains("removes the Judie application"));
        assert!(text.contains("~/.local/share/judie"));
        assert!(text.contains("widgets"));
        assert!(text.contains("routines"));
        assert!(text.contains("stays on screen"));
    }
}
