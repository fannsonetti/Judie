/** Linux WebKitGTK / kiosk user agent, not Android. */
export function isLinuxWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("linux") && !ua.includes("android");
}

export function markLinuxApp(): void {
  if (typeof document === "undefined" || !isLinuxWebview()) return;
  document.documentElement.classList.add("linux-app");
}
