use serde::Serialize;
use std::process::{Command, Stdio};

#[derive(Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LinkStatus {
    pub kind: String,
    pub ssid: String,
    pub bars: i32,
    pub state: String,
    pub ip: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WifiNet {
    pub ssid: String,
    pub signal: String,
    pub bars: i32,
    pub secured: bool,
    pub saved: bool,
    pub connected: bool,
}

fn xml_esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn run(bin: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(bin)
        .args(args)
        .stdin(Stdio::null())
        .output()
        .map_err(|e| format!("{bin}: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if stderr.is_empty() {
            return Ok(stdout);
        }
        return Err(stderr);
    }
    Ok(stdout)
}

fn bars_from_pct(pct: i32) -> i32 {
    if pct >= 80 {
        4
    } else if pct >= 55 {
        3
    } else if pct >= 30 {
        2
    } else if pct > 0 {
        1
    } else {
        0
    }
}

#[cfg(windows)]
pub fn link_status() -> LinkStatus {
    let iface = run("netsh", &["wlan", "show", "interfaces"]).unwrap_or_default();
    let mut ssid = String::new();
    let mut state = String::new();
    let mut signal = 0;
    for line in iface.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("SSID") {
            if rest.contains(':') && !line.to_lowercase().contains("bssid") {
                ssid = rest.split_once(':').map(|(_, v)| v.trim().to_string()).unwrap_or_default();
            }
        }
        if line.to_lowercase().starts_with("state") {
            state = line.split_once(':').map(|(_, v)| v.trim().to_string()).unwrap_or_default();
        }
        if line.to_lowercase().starts_with("signal") {
            let raw = line.split_once(':').map(|(_, v)| v.trim()).unwrap_or("");
            signal = raw.trim_end_matches('%').trim().parse().unwrap_or(0);
        }
    }
    let connected = state.to_lowercase().contains("connected") && !ssid.is_empty();
    if connected {
        return LinkStatus {
            kind: "wifi".into(),
            ssid,
            bars: bars_from_pct(signal),
            state: "connected".into(),
            ip: String::new(),
        };
    }

    let adapters = run("netsh", &["interface", "show", "interface"]).unwrap_or_default();
    let ethernet = adapters.lines().any(|l| {
        let low = l.to_lowercase();
        low.contains("connected") && (low.contains("ethernet") || low.contains("local area"))
    });
    if ethernet {
        LinkStatus {
            kind: "ethernet".into(),
            ssid: "Ethernet".into(),
            bars: 4,
            state: "connected".into(),
            ip: String::new(),
        }
    } else {
        LinkStatus {
            kind: "wifi".into(),
            ssid: String::new(),
            bars: 0,
            state: "disconnected".into(),
            ip: String::new(),
        }
    }
}

#[cfg(not(windows))]
pub fn link_status() -> LinkStatus {
    LinkStatus {
        kind: "ethernet".into(),
        ssid: "Ethernet".into(),
        bars: 4,
        state: "connected".into(),
        ip: String::new(),
    }
}

#[cfg(windows)]
pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    let out = run("netsh", &["wlan", "show", "networks", "mode=bssid"])?;
    let current = link_status();
    let mut nets = Vec::new();
    let mut ssid = String::new();
    let mut auth = String::new();
    let mut signal = 0;
    let flush = |nets: &mut Vec<WifiNet>, ssid: &str, auth: &str, signal: i32, current: &LinkStatus| {
        if ssid.is_empty() {
            return;
        }
        if nets.iter().any(|n| n.ssid == ssid) {
            return;
        }
        nets.push(WifiNet {
            connected: current.kind == "wifi" && current.ssid == ssid,
            ssid: ssid.to_string(),
            signal: format!("{signal}%"),
            bars: bars_from_pct(signal),
            secured: !auth.to_lowercase().contains("open"),
            saved: false,
        });
    };
    for line in out.lines() {
        let t = line.trim();
        if t.starts_with("SSID") && t.contains(':') && !t.to_lowercase().contains("bssid") {
            flush(&mut nets, &ssid, &auth, signal, &current);
            ssid = t.split_once(':').map(|(_, v)| v.trim().to_string()).unwrap_or_default();
            auth.clear();
            signal = 0;
        } else if t.to_lowercase().starts_with("authentication") {
            auth = t.split_once(':').map(|(_, v)| v.trim().to_string()).unwrap_or_default();
        } else if t.to_lowercase().starts_with("signal") {
            let raw = t.split_once(':').map(|(_, v)| v.trim()).unwrap_or("");
            signal = raw.trim_end_matches('%').trim().parse().unwrap_or(0);
        }
    }
    flush(&mut nets, &ssid, &auth, signal, &current);
    Ok(nets)
}

#[cfg(not(windows))]
pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    Ok(Vec::new())
}

#[cfg(windows)]
pub fn wifi_connect(ssid: &str, pass: &str) -> Result<(), String> {
    if ssid.trim().is_empty() {
        return Err("Pick a network first".into());
    }
    if !pass.is_empty() {
        let name = xml_esc(ssid);
        let key = xml_esc(pass);
        let xml = format!(
            r#"<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{name}</name>
  <SSIDConfig><SSID><name>{name}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>WPA2PSK</authentication>
        <encryption>AES</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      <sharedKey>
        <keyType>passPhrase</keyType>
        <protected>false</protected>
        <keyMaterial>{key}</keyMaterial>
      </sharedKey>
    </security>
  </MSM>
</WLANProfile>"#
        );
        let path = std::env::temp_dir().join("judie-wifi.xml");
        std::fs::write(&path, xml).map_err(|e| e.to_string())?;
        let _ = run("netsh", &["wlan", "add", "profile", &format!("filename={}", path.display())]);
    }
    run("netsh", &["wlan", "connect", &format!("name={ssid}")]).map(|_| ())
}

#[cfg(not(windows))]
pub fn wifi_connect(_ssid: &str, _pass: &str) -> Result<(), String> {
    Err("Wi-Fi join is available on Windows and the Pi panel.".into())
}

#[cfg(windows)]
pub fn wifi_disconnect() -> Result<(), String> {
    run("netsh", &["wlan", "disconnect"]).map(|_| ())
}

#[cfg(not(windows))]
pub fn wifi_disconnect() -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn reconnect(preferred: &str) -> Result<(), String> {
    let link = link_status();
    let want_wifi = preferred != "ethernet";
    if want_wifi && link.kind == "wifi" && !link.ssid.is_empty() {
        let ssid = link.ssid.clone();
        let _ = wifi_disconnect();
        return wifi_connect(&ssid, "");
    }
    run("ipconfig", &["/renew"]).map(|_| ())
}

#[cfg(not(windows))]
pub fn reconnect(_preferred: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
pub fn set_dhcp(on: bool) -> Result<(), String> {
    if !on {
        return Ok(());
    }
    for name in ["Wi-Fi", "WiFi", "Wireless Network Connection", "Ethernet", "Local Area Connection"] {
        let _ = run(
            "netsh",
            &["interface", "ip", "set", "address", &format!("name={name}"), "source=dhcp"],
        );
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn set_dhcp(_on: bool) -> Result<(), String> {
    Ok(())
}
