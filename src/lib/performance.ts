import { isLinuxWebview } from "./platform";

export function overlayTransition() {
  if (isLinuxWebview()) return { duration: 0 };
  return { duration: 0.18, ease: "easeOut" as const };
}
