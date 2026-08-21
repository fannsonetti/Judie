import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ActionSource } from "../assistant/types";

export interface ActivityItem {
  id: string;
  ts: number;
  source: ActionSource;
  title: string;
  detail?: string;
  intent?: string;
  outcome: "ok" | "fail" | "partial";
}

interface ActivityState {
  items: ActivityItem[];
  push: (item: Omit<ActivityItem, "id" | "ts"> & { ts?: number }) => ActivityItem;
  clear: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      items: [],
      push: (item) => {
        const row: ActivityItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ts: item.ts ?? Date.now(),
          source: item.source,
          title: item.title,
          detail: item.detail,
          intent: item.intent,
          outcome: item.outcome,
        };
        set({ items: [row, ...get().items].slice(0, 120) });
        return row;
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: "judie-activity",
      partialize: (s) => ({ items: s.items.slice(0, 80) }),
    }
  )
);
