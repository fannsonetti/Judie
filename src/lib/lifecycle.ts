import { enable } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export async function bootLifecycle(onUpdating?: () => void) {
  try {
    await enable();
  } catch (error) {
    console.warn("Judie autostart registration failed", error);
  }

  try {
    const update = await check();
    if (!update) return;

    onUpdating?.();
    await update.downloadAndInstall();
    await relaunch();
  } catch (error) {
    console.warn("Judie update check failed", error);
  }
}
