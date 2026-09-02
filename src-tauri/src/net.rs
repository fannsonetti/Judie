use serde::Serialize;

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

pub fn link_status() -> LinkStatus {
    LinkStatus {
        kind: "ethernet".into(),
        ssid: "Ethernet".into(),
        bars: 4,
        state: "connected".into(),
        ip: String::new(),
    }
}

pub fn wifi_scan() -> Result<Vec<WifiNet>, String> {
    Ok(Vec::new())
}

pub fn wifi_connect(_ssid: &str, _pass: &str) -> Result<(), String> {
    Err("Wi-Fi join is available on the Pi panel.".into())
}

pub fn wifi_disconnect() -> Result<(), String> {
    Ok(())
}

pub fn reconnect(_preferred: &str) -> Result<(), String> {
    Ok(())
}

pub fn set_dhcp(_on: bool) -> Result<(), String> {
    Ok(())
}
