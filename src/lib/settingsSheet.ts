/** Settings sheet open/close physics. Visual interpolation always starts from the current pull. */

export const SETTINGS_DISTANCE = 0.32;
export const SETTINGS_FLICK = 0.85;
export const SETTINGS_MIN_TRAVEL = 0.06;
export const SETTINGS_SLOP_PX = 18;
export const SETTINGS_CLOSE_EDGE_PX = 28;
export const SETTINGS_ANIM_MS = 240;
export const SETTINGS_REDUCED_MS = 90;

export type SettingsGesture = "open" | "close";

export type SettingsDrag = {
  kind: SettingsGesture;
  startY: number;
  base: number;
  pull: number;
  velocity: number;
  lastY: number;
  lastAt: number;
  locked: boolean;
};

export function clampPull(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function canBeginOpen(settingsOpen: boolean, pull: number): boolean {
  return !settingsOpen && pull < 0.08;
}

export function canBeginClose(settingsOpen: boolean, pull: number): boolean {
  return settingsOpen || pull > 0.92;
}

export function isPageScroll(y: number, height: number, edgePx = SETTINGS_CLOSE_EDGE_PX): boolean {
  return !inCloseEdge(y, height, edgePx);
}

export function inOpenZone(x: number, width: number): boolean {
  return width > 0 && x >= (width * 2) / 3;
}

export function inCloseEdge(y: number, height: number, edgePx = SETTINGS_CLOSE_EDGE_PX): boolean {
  return height > 0 && y >= height - edgePx;
}

export function pullFromPointer(base: number, startY: number, y: number, height: number): number {
  if (height <= 0) return clampPull(base);
  return clampPull(base + (y - startY) / height);
}

export function beginSettingsDrag(
  kind: SettingsGesture,
  y: number,
  pull: number,
  now: number,
): SettingsDrag {
  return {
    kind,
    startY: y,
    base: pull,
    pull,
    velocity: 0,
    lastY: y,
    lastAt: now,
    locked: false,
  };
}

export function moveSettingsDrag(drag: SettingsDrag, y: number, height: number, now: number): SettingsDrag {
  const pull = pullFromPointer(drag.base, drag.startY, y, height);
  const dt = (now - drag.lastAt) / 1000;
  let velocity = drag.velocity;
  if (dt > 0.001 && dt < 0.12) {
    const inst = (pull - drag.pull) / dt;
    velocity = velocity * 0.55 + inst * 0.45;
  }
  const delta = y - drag.startY;
  const locked =
    drag.locked ||
    (drag.kind === "open" ? delta > SETTINGS_SLOP_PX : delta < -SETTINGS_SLOP_PX);
  return { ...drag, pull, velocity, lastY: y, lastAt: now, locked };
}

export function traveledPull(kind: SettingsGesture, pull: number): number {
  return kind === "open" ? pull : 1 - pull;
}

export function shouldCompleteSettings(drag: SettingsDrag, cancelled: boolean): boolean {
  if (cancelled) return false;
  const traveled = traveledPull(drag.kind, drag.pull);
  if (traveled < SETTINGS_MIN_TRAVEL) return false;
  if (drag.kind === "open") {
    if (drag.velocity > SETTINGS_FLICK) return true;
    if (drag.velocity < -SETTINGS_FLICK) return false;
    return drag.pull >= SETTINGS_DISTANCE;
  }
  if (drag.velocity < -SETTINGS_FLICK) return true;
  if (drag.velocity > SETTINGS_FLICK) return false;
  return drag.pull <= 1 - SETTINGS_DISTANCE;
}

export function settleTarget(kind: SettingsGesture, complete: boolean): 0 | 1 {
  if (kind === "open") return complete ? 1 : 0;
  return complete ? 0 : 1;
}

export function settingsAnimMs(reducedMotion: boolean): number {
  return reducedMotion ? SETTINGS_REDUCED_MS : SETTINGS_ANIM_MS;
}

export function interpolatePull(from: number, to: number, t: number, reducedMotion: boolean): number {
  const u = Math.max(0, Math.min(1, t));
  const eased = reducedMotion ? u : 1 - (1 - u) ** 3;
  return from + (to - from) * eased;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
