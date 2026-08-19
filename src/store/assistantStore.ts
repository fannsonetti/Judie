import { create } from "zustand";
import {
  applyContextFromResult,
  emptyContext,
  processUtterance,
  ConversationContext,
  ProcessResult,
} from "../assistant";
import { ActionSource } from "../assistant/types";
import { describeAction } from "../lib/routines";
import { log } from "../lib/logger";
import { speak, stopSpeech } from "../lib/tts";
import { createRecognizer, speechSupported } from "../lib/speech";
import { useActivityStore } from "./activityStore";
import { useRoomStore } from "./roomStore";
import { useSettingsStore } from "./settingsStore";
import { appendConversationLog } from "../lib/conversationLog";

export type AssistantStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "executing"
  | "speaking"
  | "error";

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  kind: "info" | "timer" | "warn";
}

interface AssistantState {
  status: AssistantStatus;
  transcript: string;
  lastResponse: string;
  lastResult: ProcessResult | null;
  context: ConversationContext;
  paletteOpen: boolean;
  settingsOpen: boolean;
  debugOpen: boolean;
  toasts: ToastItem[];
  listenSupported: boolean;

  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setDebugOpen: (open: boolean) => void;
  setStatus: (status: AssistantStatus) => void;
  pushToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
  execute: (text: string, source?: ActionSource, speakReply?: boolean) => Promise<ProcessResult | null>;
  startListening: () => void;
  stopListening: () => void;
  bargeIn: () => void;
}

let recognizer: ReturnType<typeof createRecognizer> = null;
let listenGen = 0;

export const useAssistantStore = create<AssistantState>((set, get) => ({
  status: "idle",
  transcript: "",
  lastResponse: "",
  lastResult: null,
  context: emptyContext(),
  paletteOpen: false,
  settingsOpen: false,
  debugOpen: false,
  toasts: [],
  listenSupported: typeof window !== "undefined" && speechSupported(),

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setDebugOpen: (debugOpen) => set({ debugOpen }),
  setStatus: (status) => set({ status }),

  pushToast: (toast) => {
    if (useRoomStore.getState().doNotDisturb && toast.kind !== "timer") return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-4) });
    window.setTimeout(() => get().dismissToast(id), 8000);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  execute: async (text, source = "assistant", speakReply) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const t0 = performance.now();
    get().bargeIn();
    set({ status: "thinking", transcript: trimmed });

    const activity = useActivityStore.getState().items[0];
    const snap = useRoomStore.getState().snapshot(
      activity
        ? { title: activity.title, source: activity.source, ts: activity.ts }
        : undefined
    );
    const settings = useSettingsStore.getState();

    if (/^(stop|shut up|be quiet)$/i.test(trimmed)) {
      stopSpeech();
      set({ status: "idle", lastResponse: "Okay." });
      void appendConversationLog({ role: "you", text: trimmed, source, intent: "assistant.stop" });
      void appendConversationLog({ role: "nova", text: "Okay.", source, intent: "assistant.stop" });
      return null;
    }

    const result = processUtterance(trimmed, snap, get().context);
    set({ status: "executing", lastResult: result });

    if (result.intent === "assistant.undo") {
      const ok = useRoomStore.getState().undo();
      result.response = ok ? "Undone." : "Nothing to undo.";
      result.spoken = result.response;
      result.success = ok;
    } else if (result.actions.length) {
      useRoomStore.getState().applyActions(result.actions, source);
    }

    const title = result.response || "Nova";
    useActivityStore.getState().push({
      source,
      title,
      detail: result.actions.map(describeAction).join(" · ") || undefined,
      intent: result.intent ?? undefined,
      outcome: result.success ? "ok" : "partial",
    });

    log.info("assistant command", {
      component: "assistant",
      action: result.intent ?? "unknown",
      requestId: String(Math.round(t0)),
      durationMs: Math.round(performance.now() - t0),
      outcome: result.success ? "ok" : "fail",
    });

    void appendConversationLog({
      role: "you",
      text: trimmed,
      source,
      intent: result.intent,
    });
    if (result.response) {
      void appendConversationLog({
        role: "nova",
        text: result.response,
        source,
        intent: result.intent,
      });
    }

    const shouldSpeak = speakReply ?? (source === "assistant" && settings.speakReplies);
    const spoken = result.spoken || result.response;
    set({
      lastResponse: result.response,
      context: applyContextFromResult(get().context, result, trimmed),
    });

    if (shouldSpeak && spoken && settings.voiceEnabled) {
      set({ status: "speaking" });
      const started = speak(spoken, () => {
        if (get().status === "speaking") set({ status: "idle" });
      });
      if (!started) set({ status: "idle" });
    } else {
      set({ status: "idle" });
    }

    return result;
  },

  bargeIn: () => {
    stopSpeech();
    if (get().status === "speaking") set({ status: "idle" });
  },

  startListening: () => {
    const settings = useSettingsStore.getState();
    if (!settings.voiceEnabled) {
      get().setPaletteOpen(true);
      return;
    }
    get().bargeIn();
    if (!speechSupported()) {
      set({ status: "error" });
      get().pushToast({
        kind: "warn",
        title: "Voice unavailable",
        body: "This window doesn't support speech recognition. Type with Ctrl+K.",
      });
      get().setPaletteOpen(true);
      return;
    }
    recognizer?.abort();
    const rec = createRecognizer();
    if (!rec) return;
    recognizer = rec;
    const gen = ++listenGen;
    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const text = last?.[0]?.transcript ?? "";
      set({ transcript: text });
      if (last && (last as { isFinal?: boolean }).isFinal) {
        rec.stop();
        void get().execute(text, "assistant", true);
      }
    };
    rec.onerror = (ev) => {
      if (gen !== listenGen) return;
      log.warn("speech error", { component: "speech", error: ev.error, action: "listen" });
      set({ status: ev.error === "no-speech" ? "idle" : "error" });
    };
    rec.onend = () => {
      if (gen !== listenGen) return;
      if (get().status === "listening") set({ status: "idle" });
    };
    try {
      rec.start();
      set({ status: "listening", transcript: "" });
    } catch {
      set({ status: "error" });
    }
  },

  stopListening: () => {
    listenGen += 1;
    recognizer?.stop();
    if (get().status === "listening") set({ status: "idle" });
  },
}));
