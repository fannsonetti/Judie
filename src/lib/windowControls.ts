import { getCurrentWindow } from "@tauri-apps/api/window";
import { setKiosk } from "./install";

let restoreFullscreen = false;

async function win() {
  return getCurrentWindow();
}

export async function minimizeJudie() {
  const w = await win();
  try {
    const fs = await w.isFullscreen();
    restoreFullscreen = fs;
    if (fs) await w.setFullscreen(false);
  } catch {
    restoreFullscreen = true;
    try {
      await w.setFullscreen(false);
    } catch {
      /* ignore */
    }
  }
  await w.minimize();
}

export async function relaunchJudie() {
  try {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch {
    window.location.reload();
  }
}

export async function quitJudie() {
  try {
    const { exit } = await import("@tauri-apps/plugin-process");
    await exit(0);
  } catch {
    await (await win()).close();
  }
}

export async function enterFullscreen() {
  restoreFullscreen = false;
  const w = await win();
  try {
    await w.setDecorations(false);
  } catch {
    /* ignore */
  }
  await w.setFullscreen(true);
  try {
    await setKiosk(true);
  } catch {
    /* vite */
  }
}

export async function leaveFullscreen() {
  restoreFullscreen = false;
  const w = await win();
  await w.setFullscreen(false);
  try {
    await w.setDecorations(true);
  } catch {
    /* ignore */
  }
  try {
    await setKiosk(false);
  } catch {
    /* vite */
  }
}

export function watchKioskFocus() {
  let unlisten: (() => void) | undefined;
  void (async () => {
    try {
      const w = await win();
      unlisten = await w.onFocusChanged(({ payload: focused }) => {
        if (focused && restoreFullscreen) {
          restoreFullscreen = false;
          void w.setFullscreen(true);
        }
      });
    } catch {
      /* browser / vite */
    }
  })();
  return () => unlisten?.();
}
