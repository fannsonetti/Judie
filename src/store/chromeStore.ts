import { create } from "zustand";

export type KbCommand =
  | "back"
  | "word-back"
  | "enter"
  | "esc"
  | "tab"
  | "delete";

interface ChromeState {
  settingsPull: number;
  settingsTracking: boolean;
  netMenuOpen: boolean;
  kbOpen: boolean;
  kbField: string;
  kbText: string;
  kbShift: boolean;
  kbCaps: boolean;
  kbFn: boolean;
  kbCtrl: boolean;
  kbAlt: boolean;
  kbEnterSeq: number;

  setSettingsPull: (n: number) => void;
  setSettingsTracking: (on: boolean) => void;
  setNetMenuOpen: (open: boolean) => void;
  openKeyboard: (field: string, seed: string) => void;
  closeKeyboard: () => void;
  typeKey: (ch: string) => void;
  kbCommand: (cmd: KbCommand) => void;
  setKbText: (text: string) => void;
}

export const useChromeStore = create<ChromeState>((set, get) => ({
  settingsPull: 0,
  settingsTracking: false,
  netMenuOpen: false,
  kbOpen: false,
  kbField: "",
  kbText: "",
  kbShift: false,
  kbCaps: false,
  kbFn: false,
  kbCtrl: false,
  kbAlt: false,
  kbEnterSeq: 0,

  setSettingsPull: (settingsPull) => set({ settingsPull }),
  setSettingsTracking: (settingsTracking) => set({ settingsTracking }),
  setNetMenuOpen: (netMenuOpen) => set({ netMenuOpen }),
  openKeyboard: (kbField, seed) =>
    set({ kbOpen: true, kbField, kbText: seed, kbShift: false, kbFn: false }),
  closeKeyboard: () => set({ kbOpen: false, kbField: "" }),
  setKbText: (kbText) => set({ kbText }),
  typeKey: (ch) => {
    const s = get();
    let next = s.kbText + ch;
    set({ kbText: next, kbShift: false });
  },
  kbCommand: (cmd) => {
    const s = get();
    if (cmd === "esc") {
      set({ kbOpen: false, kbField: "" });
      return;
    }
    if (cmd === "enter") {
      set({ kbOpen: false, kbEnterSeq: s.kbEnterSeq + 1 });
      return;
    }
    if (cmd === "back" || cmd === "delete") {
      set({ kbText: s.kbText.slice(0, -1) });
      return;
    }
    if (cmd === "word-back") {
      const trimmed = s.kbText.trimEnd();
      const cut = Math.max(0, trimmed.lastIndexOf(" "));
      set({ kbText: s.kbText.slice(0, cut === 0 ? 0 : cut + 1).trimEnd() });
      return;
    }
    if (cmd === "tab") {
      set({ kbText: s.kbText + "\t" });
    }
  },
}));
