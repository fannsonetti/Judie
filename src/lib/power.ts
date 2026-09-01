export const POWER_ACTIONS = ["reboot", "poweroff", "uninstall"] as const;
export type PowerAction = (typeof POWER_ACTIONS)[number];

export function allowedPowerAction(raw: string): PowerAction {
  if (raw === "reboot" || raw === "poweroff" || raw === "uninstall") return raw;
  if (raw === "shutdown") return "poweroff";
  throw new Error("Unknown power action");
}

export function powerMockEnabled() {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  if (env?.JUDIE_POWER_MOCK) return true;
  try {
    if (typeof localStorage !== "undefined" && localStorage.getItem("JUDIE_POWER_MOCK") === "1") return true;
  } catch {
    /* ignore */
  }
  // Vite / browser has no kiosk helper. Do not relaunch, quit, or uninstall.
  if (typeof window !== "undefined" && !(window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    return true;
  }
  return false;
}

export function uninstallWarning(kind: "pi" | "desktop" = "desktop") {
  if (kind === "pi") {
    return "This removes the Judie application, kiosk helpers, and autostart from this Raspberry Pi.\n\nKept on this computer:\n• Room settings, widgets, and routines (~/.local/share/judie)\n• Saved Wi-Fi networks\n\nThe panel stays on screen until uninstall finishes, then it reboots to the normal login screen.";
  }
  return "This removes the Judie application from this computer.\n\nKept on this computer:\n• Room settings, widgets, and routines\n• Saved preferences\n\nJudie will quit after uninstall. Your room data is not deleted.";
}

export function powerStatusLabel(action: PowerAction) {
  if (action === "reboot") return "Restarting…";
  if (action === "poweroff") return "Shutting down…";
  return "Removing Judie. Settings stay on this computer…";
}
