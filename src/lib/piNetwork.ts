/** Raspberry Pi network UI helpers. No credentials are stored or logged. */

export const WIFI_SSID_MAX = 32;

export type NetReach = "internet" | "local" | "limited" | "none";
export type NetKind = "wifi" | "ethernet" | "none";
export type DiagState = "waiting" | "checking" | "passed" | "failed" | "timeout" | "unavailable";
export type WifiErrorKind =
  | "bad-password"
  | "unavailable"
  | "permission"
  | "timeout"
  | "unsupported"
  | "backend"
  | "scan"
  | "other";

export type ConnectionDetail = {
  connType: NetKind;
  iface: string;
  ssid: string;
  state: string;
  signal: string;
  security: string;
  ipv4: string;
  ipv6: string;
  gateway: string;
  dns: string;
  mac: string;
  speed: string;
  reach: NetReach;
};

export type ScanNet = {
  ssid: string;
  signal: number;
  bars: number;
  security: string;
  saved: boolean;
  connected: boolean;
};

export function sanitizeSsid(raw: string): string | null {
  const trimmed = raw.replace(/[\n\r\t\0]/g, "").trim();
  if (!trimmed || trimmed.length > WIFI_SSID_MAX) return null;
  if (/[\x00-\x1f]/.test(trimmed)) return null;
  return trimmed;
}

export function barsFromSignal(signal: number): number {
  if (signal >= 80) return 4;
  if (signal >= 55) return 3;
  if (signal >= 30) return 2;
  if (signal >= 1) return 1;
  return 0;
}

export function dedupeScan(nets: ScanNet[]): ScanNet[] {
  const by = new Map<string, ScanNet>();
  for (const n of nets) {
    const prev = by.get(n.ssid);
    if (!prev || n.signal > prev.signal) by.set(n.ssid, n);
  }
  return [...by.values()].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    if (a.saved !== b.saved) return a.saved ? -1 : 1;
    return b.signal - a.signal;
  });
}

export function classifyWifiError(raw: string): WifiErrorKind {
  const m = raw.toLowerCase();
  if (/not authorized|permission|sudo:|a password is required/.test(m)) return "permission";
  if (/password|psk|802-11-wireless-security|secrets were required|wrong.*key/.test(m)) return "bad-password";
  if (/no network|not found|gone|out of range|no longer/.test(m)) return "unavailable";
  if (/timeout|timed out/.test(m)) return "timeout";
  if (/unsupported|sae|wpa3|wep/.test(m) && /not|unsupport|fail/.test(m)) return "unsupported";
  if (/no nmcli|backend|missing helper|could not run/.test(m)) return "backend";
  if (/scan/.test(m)) return "scan";
  return "other";
}

export function wifiErrorMessage(kind: WifiErrorKind): string {
  switch (kind) {
    case "bad-password":
      return "Incorrect password.";
    case "unavailable":
      return "That network is no longer available.";
    case "permission":
      return "Network changes need permission on this Raspberry Pi.";
    case "timeout":
      return "The network operation timed out.";
    case "unsupported":
      return "This security type is not supported.";
    case "backend":
      return "The network helper is unavailable.";
    case "scan":
      return "Wi-Fi scan failed.";
    default:
      return "Could not complete the network action.";
  }
}

export function redactSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join("••••");
}

export function reachFromNm(connectivity: string, hasAddress: boolean): NetReach {
  const c = connectivity.trim().toLowerCase();
  if (c === "full") return "internet";
  if (c === "portal" || c === "limited") return "limited";
  if (hasAddress) return "local";
  return "none";
}

export function connectionHeadline(d: ConnectionDetail): string {
  if (d.connType === "none" || d.state === "down" || d.state === "disconnected") return "Disconnected";
  if (d.connType === "ethernet") {
    if (d.reach === "internet") return "Ethernet · internet";
    if (d.reach === "limited") return "Ethernet · limited";
    return "Ethernet connected";
  }
  if (d.connType === "wifi") {
    if (d.reach === "internet") return "Wi-Fi connected · internet";
    if (d.reach === "limited") return "Wi-Fi · limited";
    if (d.reach === "local") return "Wi-Fi · local only";
    return "Wi-Fi connected";
  }
  return "Disconnected";
}

export function neverPersistSecrets(blob: string): boolean {
  const lower = blob.toLowerCase();
  return !/wifi-sec\.psk\s+\S+/.test(lower) && !/"psk"\s*:\s*"[^"]+"/.test(blob);
}
