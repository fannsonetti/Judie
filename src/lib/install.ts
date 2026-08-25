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

export async function uninstallJudie() {
  await invoke("uninstall_judie");
}

export async function getKiosk(): Promise<boolean> {
  return invoke<boolean>("get_kiosk");
}

export async function setKiosk(enabled: boolean) {
  await invoke("set_kiosk", { enabled });
}
