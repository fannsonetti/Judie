import { invoke } from "@tauri-apps/api/core";

export interface NetworkLink {
  kind: string;
  ssid: string;
  bars: number;
  state: string;
  ip: string;
}

export interface WifiNet {
  ssid: string;
  signal: string;
  bars: number;
  secured: boolean;
  saved: boolean;
  connected: boolean;
}

export async function networkLink(): Promise<NetworkLink> {
  try {
    return await invoke<NetworkLink>("network_link");
  } catch {
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    return {
      kind: online ? "ethernet" : "wifi",
      ssid: online ? "Ethernet" : "",
      bars: online ? 4 : 0,
      state: online ? "connected" : "disconnected",
      ip: "",
    };
  }
}

export async function wifiScan(): Promise<WifiNet[]> {
  try {
    return await invoke<WifiNet[]>("wifi_scan");
  } catch {
    return [];
  }
}

export async function wifiConnect(ssid: string, password: string) {
  await invoke("wifi_connect", { ssid, password });
}

export async function wifiDisconnect() {
  await invoke("wifi_disconnect");
}

export async function networkReconnect(preferred: string) {
  try {
    await invoke("network_reconnect", { preferred });
  } catch {
    window.location.reload();
  }
}

export async function networkSetDhcp(on: boolean) {
  try {
    await invoke("network_set_dhcp", { on });
  } catch {
    /* persisted in settings; host apply is Tauri-only */
  }
}
