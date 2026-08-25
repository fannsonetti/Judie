import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export interface LatestUpdate {
  current: string;
  latest: string;
  latestTag: string;
  outdated: boolean;
  installable: boolean;
}

interface UpdateState {
  notice: LatestUpdate | null;
  dismissed: boolean;
  installing: boolean;
  error: string | null;
  check: () => Promise<void>;
  dismiss: () => void;
  installLatest: () => Promise<void>;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  notice: null,
  dismissed: false,
  installing: false,
  error: null,
  check: async () => {
    try {
      const notice = await invoke<LatestUpdate>("check_latest_update");
      set({ notice, error: null });
    } catch {
      set({ notice: null });
    }
  },
  dismiss: () => set({ dismissed: true }),
  installLatest: async () => {
    if (get().installing) return;
    set({ installing: true, error: null });
    try {
      await invoke("install_latest_update");
    } catch (e) {
      const message =
        typeof e === "string" ? e : e instanceof Error ? e.message : String(e);
      set({ installing: false, error: message });
    }
  },
}));

export function bootLifecycle() {
  const run = () => void useUpdateStore.getState().check();
  run();
  window.setTimeout(run, 45_000);
}
