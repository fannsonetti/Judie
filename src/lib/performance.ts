import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PerformanceMode = "auto" | "desktop" | "pi";

interface PerformanceState {
  mode: PerformanceMode;
  /** Resolved after auto-detect / user override. */
  reduced: boolean;
  setMode: (mode: PerformanceMode) => void;
  refresh: () => void;
}

function looksLikePiClass(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const cores = navigator.hardwareConcurrency || 8;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const arm =
    ua.includes("aarch64") ||
    ua.includes("armv7") ||
    ua.includes("arm64") ||
    ua.includes("armhf") ||
    ua.includes("raspberry");
  const linux = ua.includes("linux") || ua.includes("wayland") || ua.includes("x11");

  if (mem !== undefined && mem <= 2) return true;
  if (arm && cores <= 4) return true;
  // Pi 3 on 64-bit OS often reports 4 cores and Linux without "arm" in Chromium UA.
  if (linux && cores <= 4 && mem !== undefined && mem <= 4) return true;
  return false;
}

function resolveReduced(mode: PerformanceMode): boolean {
  if (mode === "pi") return true;
  if (mode === "desktop") return false;
  return looksLikePiClass();
}

function applyDom(reduced: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("perf-pi", reduced);
  document.documentElement.dataset.perf = reduced ? "pi" : "desktop";
}

export const usePerformanceStore = create<PerformanceState>()(
  persist(
    (set, get) => ({
      mode: "auto",
      reduced: false,
      setMode: (mode) => {
        const reduced = resolveReduced(mode);
        applyDom(reduced);
        set({ mode, reduced });
      },
      refresh: () => {
        const reduced = resolveReduced(get().mode);
        applyDom(reduced);
        set({ reduced });
      },
    }),
    {
      name: "judie-performance",
      version: 1,
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => (state) => {
        state?.refresh();
      },
    }
  )
);

export function bootPerformance() {
  usePerformanceStore.getState().refresh();
}

/** Short fade for Pi; spring for desktop. */
export function overlayTransition(reduced: boolean) {
  return reduced
    ? { duration: 0.12, ease: "easeOut" as const }
    : { type: "spring" as const, stiffness: 420, damping: 34 };
}
