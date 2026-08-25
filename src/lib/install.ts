import { invoke } from "@tauri-apps/api/core";
import { JUDIE_VERSION } from "./version";

export interface ReleaseInfo {
  tag: string;
  name: string;
  publishedAt: string;
  current: boolean;
  installable: boolean;
  assetName: string;
  assetUrl: string;
}

export function releaseLabel(r: ReleaseInfo) {
  const tag = r.tag.replace(/^v/, "");
  const now = r.current || tag === JUDIE_VERSION ? " · this version" : "";
  return `${r.name}${now}`;
}

export async function listInstallations(): Promise<ReleaseInfo[]> {
  return invoke<ReleaseInfo[]>("list_releases");
}

export async function switchInstallation(tag: string) {
  await invoke("install_release", { tag });
}

export function generateUninstallChallenge(length = 12): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const chars = letters + digits;
  const n = Math.max(2, length);
  const bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const out = Array.from(bytes, (b) => chars[b % chars.length]);
  const letterAt = bytes[0] % n;
  let digitAt = bytes[1] % n;
  if (digitAt === letterAt) digitAt = (digitAt + 1) % n;
  out[letterAt] = letters[bytes[0] % letters.length];
  out[digitAt] = digits[bytes[1] % digits.length];
  return out.join("");
}

export async function uninstallJudie() {
  await invoke("uninstall_judie");
}

export async function getKiosk(): Promise<boolean> {
  return invoke<boolean>("get_kiosk");
}

export async function setKiosk(enabled: boolean) {
  await invoke("set_kiosk", { enabled });
}
