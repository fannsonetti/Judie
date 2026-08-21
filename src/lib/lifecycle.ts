import { enable } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useAssistantStore } from "../store/assistantStore";

export async function bootLifecycle() {
  try {
    await enable();
  } catch (error) {
    console.warn("Judie autostart registration failed", error);
  }

  try {
    const update = await check();
    if (!update) return;

    useAssistantStore.getState().pushToast({
      kind: "info",
      title: "Updating Judie",
      body: `Installing ${update.version} from GitHub`,
    });

    await update.downloadAndInstall();
    await relaunch();
  } catch (error) {
    console.warn("Judie update check failed", error);
  }
}
