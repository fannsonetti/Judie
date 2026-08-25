/** Tauri/WebKitGTK on Linux (Raspberry Pi), not Android or desktop browsers on Windows. */
export function isLinuxWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("linux") && !ua.includes("android");
}

export function markLinuxApp(): void {
  if (typeof document === "undefined" || !isLinuxWebview()) return;
  document.documentElement.classList.add("linux-app");
}
