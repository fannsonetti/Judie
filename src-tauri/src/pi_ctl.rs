//! Kiosk helpers: Wi-Fi, power, GitHub version list for the Pi panel.

use std::collections::BTreeMap;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

#[derive(Clone, Default)]
#[allow(dead_code)]
pub struct WifiStatus {
    pub ssid: String,
    pub ip: String,
    pub state: String,
}

#[derive(Clone, Debug)]
pub struct WifiNet {
    pub ssid: String,
    pub signal: i32,
    pub bars: i32,
    pub secured: bool,
    pub saved: bool,
    pub connected: bool,
    pub security: String,
}

#[derive(Clone, Default)]
pub struct LinkStatus {
    pub kind: String,
    pub ssid: String,
    pub bars: i32,
    pub state: String,
    pub ip: String,
}

#[derive(Clone, Default)]
pub struct ConnectionDetail {
    pub conn_type: String,
    pub iface: String,
    pub ssid: String,
    pub state: String,
    pub signal: String,
    pub security: String,
    pub ipv4: String,
    pub ipv6: String,
    pub gateway: String,
    pub dns: String,
    pub mac: String,
    pub speed: String,
    pub reach: String,
}

#[derive(Clone)]
pub struct DiagResult {
    pub id: String,
    pub label: String,
    pub state: String,
    pub detail: String,
}

#[derive(Clone)]
pub struct VersionRow {
    pub tag: String,
    pub name: String,
    pub current: bool,
    pub installable: bool,
}

fn wifi_bin() -> String {
    std::env::var("JUDIE_WIFI_BIN").unwrap_or_else(|_| "/usr/lib/judie/wifi".into())
}

fn mock_path() -> Option<PathBuf> {
    std::env::var("JUDIE_WIFI_MOCK")
        .ok()
        .filter(|s| !s.is_empty())
        .map(PathBuf::from)
}

fn load_mock() -> Option<serde_json::Value> {
    let path = mock_path()?;
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

fn save_mock(v: &serde_json::Value) {
    if let Some(path) = mock_path() {
        if let Ok(json) = serde_json::to_string_pretty(v) {
            let _ = std::fs::write(path, json);
        }
    }
}

pub fn sanitize_ssid(raw: &str) -> Result<String, String> {
    let trimmed: String = raw
        .chars()
        .filter(|c| *c != '\n' && *c != '\r' && *c != '\t' && *c != '\0')
        .collect::<String>()
        .trim()
        .to_string();
    if trimmed.is_empty() || trimmed.len() > 32 {
        return Err("Invalid network name".into());
    }
    if trimmed.chars().any(|c| c.is_control()) {
        return Err("Invalid network name".into());
    }
    Ok(trimmed)
}

pub fn redact_secret(msg: &str, secret: &str) -> String {
    if secret.is_empty() {
        return msg.to_string();
    }
    msg.replace(secret, "••••")
}

pub fn classify_wifi_error(raw: &str) -> &'static str {
    let m = raw.to_ascii_lowercase();
    if m.contains("not authorized")
        || m.contains("permission")
        || m.contains("a password is required")
    {
        "Network changes need permission on this Raspberry Pi."
    } else if m.contains("password")
        || m.contains("psk")
        || m.contains("802-11-wireless-security")
        || m.contains("secrets were required")
        || m.contains("wrong")
    {
        "Incorrect password."
    } else if m.contains("no network") || m.contains("not found") || m.contains("no longer") {
        "That network is no longer available."
    } else if m.contains("timeout") || m.contains("timed out") {
        "The network operation timed out."
    } else if m.contains("unsupported") {
        "This security type is not supported."
    } else if m.contains("backend") || m.contains("no nmcli") || m.contains("could not run") {
        "The network helper is unavailable."
    } else if m.contains("scan") {
        "Wi-Fi scan failed."
    } else {
        "Could not complete the network action."
    }
}

fn sudo(bin: &str, args: &[&str]) -> Result<String, String> {
    sudo_with_stdin(bin, args, None)
}

fn sudo_with_stdin(bin: &str, args: &[&str], stdin_data: Option<&[u8]>) -> Result<String, String> {
    let mut cmd = Command::new("sudo");
    cmd.arg("-n").arg(bin).args(args);
    if stdin_data.is_some() {
        cmd.stdin(Stdio::piped());
    } else {
        cmd.stdin(Stdio::null());
    }
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not run {bin}: {e}"))?;
    if let Some(bytes) = stdin_data {
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(bytes);
        }
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("Could not run {bin}: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if !out.status.success() {
        let msg = if stderr.is_empty() { stdout } else { stderr };
        let secret = stdin_data
            .and_then(|b| std::str::from_utf8(b).ok())
            .unwrap_or("");
        let redacted = redact_secret(&msg, secret.trim_end_matches('\n'));
        return Err(if redacted.is_empty() {
            format!("{bin} failed")
        } else {
            classify_wifi_error(&redacted).to_string()
        });
    }
    Ok(stdout)
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

fn dash(s: &str) -> String {
    let t = s.trim();
    if t.is_empty() {
        "—".into()
    } else {
        t.into()
    }
}

/// Global IPv4 addresses (ethernet + wifi), no sudo.
pub fn lan_addrs() -> String {
    if let Some(mock) = load_mock() {
        if let Some(ip) = mock.get("ipv4").and_then(|v| v.as_str()) {
            return ip.to_string();
        }
    }
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
    let d = connection_detail();
    WifiStatus {
        ssid: d.ssid,
        ip: d.ipv4,
        state: d.state,
    }
}

pub fn link_status() -> LinkStatus {
    let d = connection_detail();
    let bars = d
        .signal
        .trim_end_matches('%')
        .parse()
        .map(bars_from_signal)
        .unwrap_or(0);
    LinkStatus {
        kind: d.conn_type,
        ssid: d.ssid,
        bars,
        state: d.state,
        ip: d.ipv4,
    }
}

pub fn connection_detail() -> ConnectionDetail {
    if let Some(mock) = load_mock() {
        if let Some(d) = mock.get("detail") {
            return ConnectionDetail {
                conn_type: d["connType"].as_str().unwrap_or("none").into(),
                iface: dash(d["iface"].as_str().unwrap_or("")),
                ssid: dash(d["ssid"].as_str().unwrap_or("")),
                state: dash(d["state"].as_str().unwrap_or("disconnected")),
                signal: dash(d["signal"].as_str().unwrap_or("")),
                security: dash(d["security"].as_str().unwrap_or("")),
                ipv4: dash(d["ipv4"].as_str().unwrap_or("")),
                ipv6: dash(d["ipv6"].as_str().unwrap_or("")),
                gateway: dash(d["gateway"].as_str().unwrap_or("")),
                dns: dash(d["dns"].as_str().unwrap_or("")),
                mac: dash(d["mac"].as_str().unwrap_or("")),
                speed: dash(d["speed"].as_str().unwrap_or("")),
                reach: d["reach"].as_str().unwrap_or("none").into(),
            };
        }
    }
    match sudo(&wifi_bin(), &["detail"]) {
        Ok(text) => {
            let mut d = ConnectionDetail::default();
            for line in text.lines() {
                let mut p = line.splitn(2, '\t');
                let k = p.next().unwrap_or("");
                let v = dash(p.next().unwrap_or(""));
                match k {
                    "type" => d.conn_type = v,
                    "iface" => d.iface = v,
                    "ssid" => d.ssid = v,
                    "state" => d.state = v,
                    "signal" => d.signal = v,
                    "security" => d.security = v,
                    "ipv4" => d.ipv4 = v,
                    "ipv6" => d.ipv6 = v,
                    "gateway" => d.gateway = v,
                    "dns" => d.dns = v,
                    "mac" => d.mac = v,
                    "speed" => d.speed = v,
                    "reach" => d.reach = v,
                    _ => {}
                }
            }
            if d.conn_type.is_empty() {
                d.conn_type = "none".into();
            }
            if d.reach.is_empty() {
                d.reach = "none".into();
            }
            d
        }
        Err(_) => ConnectionDetail {
            conn_type: "none".into(),
            state: "disconnected".into(),
            reach: "none".into(),
            ssid: "—".into(),
            ipv4: "—".into(),
            ..ConnectionDetail::default()
        },
    }
}

pub fn connection_headline(d: &ConnectionDetail) -> String {
    if d.conn_type == "none" || d.state == "down" || d.state == "disconnected" {
        return "Disconnected".into();
    }
    match d.conn_type.as_str() {
        "ethernet" => match d.reach.as_str() {
            "internet" => "Ethernet · internet".into(),
            "limited" => "Ethernet · limited".into(),
            _ => "Ethernet connected".into(),
        },
        "wifi" => match d.reach.as_str() {
            "internet" => "Wi-Fi connected · internet".into(),
            "limited" => "Wi-Fi · limited".into(),
            "local" => "Wi-Fi · local only".into(),
            _ => "Wi-Fi connected".into(),
        },
        _ => "Disconnected".into(),
    }
}

pub fn preferred_iface() -> String {
    if let Some(mock) = load_mock() {
        if let Some(p) = mock.get("preferred").and_then(|v| v.as_str()) {
            return p.into();
        }
    }
    sudo(&wifi_bin(), &["preferred"]).unwrap_or_else(|_| "wifi".into())
}

pub fn set_preferred_iface(kind: &str) -> Result<(), String> {
    if !matches!(kind, "ethernet" | "wifi") {
        return Err("preferred ethernet|wifi".into());
    }
    if let Some(mut mock) = load_mock() {
        mock["preferred"] = serde_json::Value::String(kind.into());
        save_mock(&mock);
        return Ok(());
    }
    sudo(&wifi_bin(), &["preferred", kind]).map(|_| ())
}

pub fn dhcp_enabled() -> bool {
    if let Some(mock) = load_mock() {
        return mock.get("dhcp").and_then(|v| v.as_bool()).unwrap_or(true);
    }
    sudo(&wifi_bin(), &["dhcp"])
        .map(|s| s.trim() == "on")
        .unwrap_or(true)
}

pub fn set_dhcp(on: bool) -> Result<(), String> {
    if let Some(mut mock) = load_mock() {
        mock["dhcp"] = serde_json::Value::Bool(on);
        save_mock(&mock);
        return Ok(());
    }
    sudo(&wifi_bin(), &["dhcp", if on { "on" } else { "off" }]).map(|_| ())
}

pub fn reconnect() -> Result<(), String> {
    if let Some(mut mock) = load_mock() {
        if mock["detail"]["connType"] == "none" {
            if let Some(prev) = mock.get("lastDetail").cloned() {
                mock["detail"] = prev;
                save_mock(&mock);
            }
        }
        return Ok(());
    }
    sudo(&wifi_bin(), &["reconnect"]).map(|_| ())
}

fn saved_names() -> BTreeMap<String, bool> {
    let mut map = BTreeMap::new();
    if let Some(mock) = load_mock() {
        if let Some(arr) = mock.get("saved").and_then(|v| v.as_array()) {
            for n in arr {
                if let Some(s) = n.as_str() {
                    map.insert(s.to_string(), true);
                }
            }
        }
        return map;
    }
    if let Ok(out) = sudo(&wifi_bin(), &["saved"]) {
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
    map
}

pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    if let Some(mock) = load_mock() {
        if let Some(err) = mock.get("scanError").and_then(|v| v.as_str()) {
            return Err(classify_wifi_error(err).into());
        }
        let current = mock
            .pointer("/detail/ssid")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let saved = saved_names();
        let mut by_ssid: BTreeMap<String, WifiNet> = BTreeMap::new();
        if let Some(arr) = mock.get("scan").and_then(|v| v.as_array()) {
            for n in arr {
                let ssid = n["ssid"].as_str().unwrap_or("").to_string();
                if ssid.is_empty() {
                    continue;
                }
                let signal = n["signal"].as_i64().unwrap_or(0) as i32;
                let security = n["security"].as_str().unwrap_or("open").to_string();
                let secured = security != "open";
                let bars = bars_from_signal(signal);
                by_ssid
                    .entry(ssid.clone())
                    .and_modify(|existing| {
                        if signal > existing.signal {
                            existing.signal = signal;
                            existing.bars = bars;
                            existing.security = security.clone();
                            existing.secured = secured;
                        }
                    })
                    .or_insert(WifiNet {
                        ssid: ssid.clone(),
                        signal,
                        bars,
                        secured,
                        saved: saved.contains_key(&ssid),
                        connected: ssid == current,
                        security,
                    });
            }
        }
        let mut nets: Vec<WifiNet> = by_ssid.into_values().collect();
        nets.sort_by(|a, b| {
            b.connected
                .cmp(&a.connected)
                .then(b.saved.cmp(&a.saved))
                .then(b.signal.cmp(&a.signal))
        });
        nets.truncate(24);
        return Ok(nets);
    }
    let out = sudo(&wifi_bin(), &["scan"]).map_err(|e| classify_wifi_error(&e).to_string())?;
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
        let security = p.next().unwrap_or("open").to_string();
        let secured = security != "open";
        let bars = bars_from_signal(signal);
        by_ssid
            .entry(ssid.to_string())
            .and_modify(|n| {
                if signal > n.signal {
                    n.signal = signal;
                    n.bars = bars;
                    n.security = security.clone();
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
                security,
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

pub fn wifi_connect(ssid: &str, pass: &str, auto: bool) -> Result<(), String> {
    wifi_connect_inner(ssid, pass, auto, false)
}

pub fn wifi_connect_hidden(ssid: &str, pass: &str) -> Result<(), String> {
    wifi_connect_inner(ssid, pass, true, true)
}

fn wifi_connect_inner(ssid: &str, pass: &str, auto: bool, hidden: bool) -> Result<(), String> {
    let ssid = sanitize_ssid(ssid)?;
    if let Some(mut mock) = load_mock() {
        if let Some(fail) = mock.get("connectError").and_then(|v| v.as_str()) {
            return Err(classify_wifi_error(fail).into());
        }
        mock["detail"] = serde_json::json!({
            "connType": "wifi",
            "iface": "wlan0",
            "ssid": ssid,
            "state": "up",
            "signal": "70%",
            "security": if pass.is_empty() { "open" } else { "WPA2" },
            "ipv4": "192.168.1.20",
            "ipv6": "—",
            "gateway": "192.168.1.1",
            "dns": "1.1.1.1",
            "mac": "aa:bb:cc:dd:ee:ff",
            "speed": "72 Mbit/s",
            "reach": mock.pointer("/detail/reach").and_then(|v| v.as_str()).unwrap_or("internet"),
        });
        if hidden {
            mock["hiddenJoined"] = serde_json::Value::Bool(true);
        }
        save_mock(&mock);
        return Ok(());
    }
    let auto_flag = if auto { "auto" } else { "off" };
    let hidden_flag = if hidden { "hidden" } else { "" };
    let bin = wifi_bin();
    let args: Vec<&str> = if hidden {
        vec!["connect", &ssid, auto_flag, hidden_flag]
    } else {
        vec!["connect", &ssid, auto_flag]
    };
    let stdin = if pass.is_empty() {
        None
    } else {
        Some(format!("{pass}\n").into_bytes())
    };
    sudo_with_stdin(&bin, &args, stdin.as_deref()).map(|_| ())
}

pub fn wifi_disconnect() -> Result<(), String> {
    if let Some(mut mock) = load_mock() {
        mock["lastDetail"] = mock["detail"].clone();
        mock["detail"] = serde_json::json!({
            "connType": "none",
            "iface": "wlan0",
            "ssid": "—",
            "state": "disconnected",
            "signal": "—",
            "security": "—",
            "ipv4": "—",
            "ipv6": "—",
            "gateway": "—",
            "dns": "—",
            "mac": "—",
            "speed": "—",
            "reach": "none",
        });
        save_mock(&mock);
        return Ok(());
    }
    sudo(&wifi_bin(), &["disconnect"]).map(|_| ())
}

pub fn wifi_forget(ssid: &str) -> Result<(), String> {
    let ssid = sanitize_ssid(ssid)?;
    if let Some(mut mock) = load_mock() {
        if let Some(arr) = mock.get_mut("saved").and_then(|v| v.as_array_mut()) {
            arr.retain(|v| v.as_str() != Some(ssid.as_str()));
        }
        if mock.pointer("/detail/ssid").and_then(|v| v.as_str()) == Some(ssid.as_str()) {
            mock["detail"]["ssid"] = serde_json::Value::String("—".into());
            mock["detail"]["connType"] = serde_json::Value::String("none".into());
            mock["detail"]["state"] = serde_json::Value::String("disconnected".into());
            mock["detail"]["reach"] = serde_json::Value::String("none".into());
        }
        save_mock(&mock);
        return Ok(());
    }
    sudo(&wifi_bin(), &["forget", &ssid]).map(|_| ())
}

pub fn run_probe(id: &str) -> DiagResult {
    let label = match id {
        "hostname" => "Hostname",
        "local" => "Local link",
        "gateway" => "Gateway",
        "dns" => "DNS",
        "internet" => "Internet",
        _ => id,
    };
    if let Some(mock) = load_mock() {
        if let Some(p) = mock.get("probes").and_then(|v| v.get(id)) {
            let state = p["state"].as_str().unwrap_or("failed").to_string();
            let detail = p["detail"].as_str().unwrap_or("").to_string();
            return DiagResult {
                id: id.into(),
                label: label.into(),
                state,
                detail,
            };
        }
    }
    let started = std::time::Instant::now();
    let result = sudo(&wifi_bin(), &["probe", id]);
    let timed_out = started.elapsed() > Duration::from_secs(8);
    match result {
        Ok(line) => {
            let mut p = line.split('\t');
            let state = p.next().unwrap_or("passed").to_string();
            let detail = p.next().unwrap_or("").to_string();
            DiagResult {
                id: id.into(),
                label: label.into(),
                state,
                detail,
            }
        }
        Err(err) => DiagResult {
            id: id.into(),
            label: label.into(),
            state: if timed_out {
                "timeout".into()
            } else if err.to_ascii_lowercase().contains("unavailable") {
                "unavailable".into()
            } else {
                "failed".into()
            },
            detail: String::new(),
        },
    }
}

pub const DIAG_IDS: &[&str] = &["hostname", "local", "gateway", "dns", "internet"];

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

#[cfg(test)]
mod net_tests {
    use super::*;
    use std::sync::Mutex;

    static MOCK_LOCK: Mutex<()> = Mutex::new(());

    fn with_mock(json: &str, f: impl FnOnce()) {
        let _g = MOCK_LOCK.lock().unwrap();
        let path = std::env::temp_dir().join(format!(
            "judie-wifi-mock-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::write(&path, json).unwrap();
        unsafe { std::env::set_var("JUDIE_WIFI_MOCK", &path); }
        f();
        unsafe { std::env::remove_var("JUDIE_WIFI_MOCK"); }
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn ssid_rejects_control_and_empty() {
        assert!(sanitize_ssid("").is_err());
        assert!(sanitize_ssid("ok-net").is_ok());
        assert!(sanitize_ssid("bad\nname").is_ok()); // newline stripped
        assert!(sanitize_ssid(&"x".repeat(33)).is_err());
    }

    #[test]
    fn secrets_never_appear_in_classified_errors() {
        let msg = redact_secret("psk=super-secret-pass failed", "super-secret-pass");
        assert!(!msg.contains("super-secret-pass"));
        assert_eq!(classify_wifi_error("Secrets were required"), "Incorrect password.");
        assert_eq!(classify_wifi_error("a password is required"), "Network changes need permission on this Raspberry Pi.");
        assert_eq!(classify_wifi_error("No network with SSID"), "That network is no longer available.");
        assert_eq!(classify_wifi_error("Not authorized"), "Network changes need permission on this Raspberry Pi.");
        assert_eq!(classify_wifi_error("Timeout waiting"), "The network operation timed out.");
        assert_eq!(classify_wifi_error("unsupported security"), "This security type is not supported.");
        assert_eq!(classify_wifi_error("no nmcli"), "The network helper is unavailable.");
        assert_eq!(classify_wifi_error("scan failed"), "Wi-Fi scan failed.");
    }

    #[test]
    fn mock_ethernet_wifi_disconnect_hidden_forget_and_probes() {
        let json = r#"{
            "detail": {"connType":"ethernet","iface":"eth0","ssid":"eth0","state":"up","signal":"—","security":"—","ipv4":"10.0.0.4","ipv6":"fe80::1","gateway":"10.0.0.1","dns":"1.1.1.1","mac":"aa:bb:cc:dd:ee:ff","speed":"1000 Mbit/s","reach":"internet"},
            "scan": [{"ssid":"Cafe","signal":80,"security":"WPA2"},{"ssid":"Cafe","signal":10,"security":"WPA2"}],
            "saved": ["Cafe"],
            "preferred": "ethernet",
            "dhcp": true,
            "probes": {
                "hostname": {"state":"passed","detail":"judie"},
                "local": {"state":"passed","detail":"10.0.0.4"},
                "gateway": {"state":"failed","detail":""},
                "dns": {"state":"failed","detail":""},
                "internet": {"state":"passed","detail":"full"}
            }
        }"#;
        with_mock(json, || {
            let d = connection_detail();
            assert_eq!(d.conn_type, "ethernet");
            assert_eq!(d.reach, "internet");
            assert_eq!(connection_headline(&d), "Ethernet · internet");
            let nets = wifi_scan().unwrap();
            assert_eq!(nets.len(), 1);
            assert_eq!(nets[0].ssid, "Cafe");
            assert_eq!(run_probe("hostname").state, "passed");
            assert_eq!(run_probe("gateway").state, "failed");
            assert_eq!(run_probe("dns").state, "failed");
            assert_eq!(run_probe("internet").state, "passed");
            wifi_disconnect().unwrap();
            reconnect().unwrap();
            assert_eq!(connection_detail().conn_type, "ethernet");
            wifi_disconnect().unwrap();
            assert_eq!(connection_detail().conn_type, "none");
            wifi_connect("Cafe", "", true).unwrap();
            assert_eq!(connection_detail().ssid, "Cafe");
            let stored = std::fs::read_to_string(mock_path().unwrap()).unwrap();
            assert!(!stored.contains("psk"));
            assert!(!stored.to_lowercase().contains("password"));
        });

        let wifi = r#"{
            "detail": {"connType":"wifi","iface":"wlan0","ssid":"Home","state":"up","signal":"70%","security":"WPA2","ipv4":"192.168.1.9","ipv6":"—","gateway":"192.168.1.1","dns":"1.1.1.1","mac":"aa:bb:cc:dd:ee:ff","speed":"72 Mbit/s","reach":"local"},
            "scan": [],
            "saved": ["Home"],
            "probes": {"internet": {"state":"failed","detail":"limited"}}
        }"#;
        with_mock(wifi, || {
            assert_eq!(connection_headline(&connection_detail()), "Wi-Fi · local only");
            wifi_forget("Home").unwrap();
            assert_eq!(connection_detail().conn_type, "none");
        });

        let hidden = r#"{"detail":{"connType":"none","ssid":"—","state":"disconnected","reach":"none","ipv4":"—","ipv6":"—","gateway":"—","dns":"—","mac":"—","speed":"—","iface":"wlan0","signal":"—","security":"—"},"scan":[],"saved":[]}"#;
        with_mock(hidden, || {
            wifi_connect_hidden("SecretNet", "not-logged").unwrap();
            let d = connection_detail();
            assert_eq!(d.ssid, "SecretNet");
            let stored = std::fs::read_to_string(mock_path().unwrap()).unwrap();
            assert!(!stored.contains("not-logged"));
        });

        let bad = r#"{"detail":{"connType":"none","ssid":"—","state":"disconnected","reach":"none","ipv4":"—","ipv6":"—","gateway":"—","dns":"—","mac":"—","speed":"—","iface":"wlan0","signal":"—","security":"—"},"connectError":"wrong password","scan":[],"saved":[]}"#;
        with_mock(bad, || {
            let err = wifi_connect("Cafe", "guess", true).unwrap_err();
            assert_eq!(err, "Incorrect password.");
            assert!(!err.contains("guess"));
        });

        let empty = r#"{"detail":{"connType":"none","ssid":"—","state":"disconnected","reach":"none","ipv4":"—","ipv6":"—","gateway":"—","dns":"—","mac":"—","speed":"—","iface":"wlan0","signal":"—","security":"—"},"scan":[],"saved":[]}"#;
        with_mock(empty, || {
            assert!(wifi_scan().unwrap().is_empty());
        });

        let timeout = r#"{"detail":{"connType":"none","ssid":"—","state":"disconnected","reach":"none","ipv4":"—","ipv6":"—","gateway":"—","dns":"—","mac":"—","speed":"—","iface":"wlan0","signal":"—","security":"—"},"connectError":"Timeout waiting for connection","scan":[],"saved":[]}"#;
        with_mock(timeout, || {
            assert_eq!(wifi_connect("Cafe", "x", true).unwrap_err(), "The network operation timed out.");
        });

        let perm = r#"{"detail":{"connType":"none","ssid":"—","state":"disconnected","reach":"none","ipv4":"—","ipv6":"—","gateway":"—","dns":"—","mac":"—","speed":"—","iface":"wlan0","signal":"—","security":"—"},"scanError":"Not authorized","scan":[],"saved":[]}"#;
        with_mock(perm, || {
            assert_eq!(wifi_scan().unwrap_err(), "Network changes need permission on this Raspberry Pi.");
        });
    }

    #[test]
    fn command_args_never_include_password() {
        let src = include_str!("pi_ctl.rs");
        assert!(!src.contains("connect\", ssid, &psk"));
        let stored_map = format!("{}{}", "passwords.", "insert(");
        assert!(!src.contains(&stored_map));
        let helper = include_str!("../linux/wifi");
        assert!(!helper.contains("password \""));
        assert!(!helper.contains("password $"));
        assert!(helper.contains("psk=%s"));
    }
}
