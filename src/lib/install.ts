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

export function isNewerVersion(candidate: string, current: string) {
  const parse = (raw: string) => {
    const parts = raw
      .trim()
      .replace(/^v/, "")
      .split(".")
      .map((p) => parseInt(p.replace(/\D.*$/, ""), 10) || 0);
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0] as const;
  };
  const a = parse(candidate);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

export function isSameVersion(a: string, b: string) {
  return a.trim().replace(/^v/, "") === b.trim().replace(/^v/, "");
}

export function versionChange(target: string, current: string): "upgrade" | "downgrade" | "same" {
  if (isSameVersion(target, current)) return "same";
  return isNewerVersion(target, current) ? "upgrade" : "downgrade";
}

export function confirmInstallBody(current: string, target: string) {
  const kind = versionChange(target, current);
  if (kind === "same") {
    return `Current version: ${current}\nTarget version: ${target}\nThis version is already installed.`;
  }
  const article = kind === "upgrade" ? "an" : "a";
  return `Current version: ${current}\nTarget version: ${target}\nThis is ${article} ${kind}.\n\nThe panel stays on screen while the package is installed. It reboots after the new version is verified. Settings, widgets, and routines stay on this panel.`;
}

export type CompatibleRelease = {
  tag: string;
  draft?: boolean;
  prerelease?: boolean;
  installable: boolean;
  assetName: string;
};

/** Mirrors the kiosk filter: skip drafts, prereleases, incompatible assets, duplicates. */
export function compatibleReleaseTags(
  rows: CompatibleRelease[],
  os: "linux" | "windows",
  arch: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (row.draft || row.prerelease || !row.installable) continue;
    const name = row.assetName.toLowerCase();
    const ok =
      os === "linux"
        ? name.endsWith(".deb") &&
          ((arch === "armhf" || arch === "arm") &&
            (name.includes("armhf") || name.includes("armv7")))
        : name.endsWith(".exe");
    if (!ok) continue;
    const key = row.tag.replace(/^v/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.tag);
  }
  return out;
}

export async function listInstallations(): Promise<ReleaseInfo[]> {
  return invoke<ReleaseInfo[]>("list_releases");
}

export async function switchInstallation(tag: string) {
  await invoke("install_release", { tag });
}

export function generateUninstallChallenge(length = 12): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const specials = "!@#$%^*-_=+?";
  const n = Math.max(4, length);
  const bytes = new Uint8Array(n);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const pools = [lower, upper, digits, specials];
  const out: string[] = [];
  out[0] = lower[bytes[0] % lower.length];
  out[1] = upper[bytes[1] % upper.length];
  out[2] = digits[bytes[2] % digits.length];
  out[3] = specials[bytes[3] % specials.length];
  for (let i = 4; i < n; i++) {
    const pool = pools[bytes[i] % 4];
    out[i] = pool[bytes[i] % pool.length];
  }
  return out.join("");
}

export function generateMathChallenge() {
  const x = 1 + Math.floor(Math.random() * 9);
  const y = 1 + Math.floor(Math.random() * 9);
  const z = 1 + Math.floor(Math.random() * 9);
  return { prompt: `${x} + ${y} × ${z}`, answer: x + y * z };
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
