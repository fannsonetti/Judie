import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createId, SlopDef } from "../slopbox/schema";

interface CustomWidgetState {
  widgets: SlopDef[];
  importOne: (def: SlopDef) => string;
  remove: (id: string) => void;
}

export const useCustomWidgetStore = create<CustomWidgetState>()(
  persist(
    (set) => ({
      widgets: [],

      importOne: (def) => {
        const incoming: SlopDef = {
          ...structuredClone(def),
          id: def.id || createId("widget"),
        };
        set((s) => {
          const exists = s.widgets.some((w) => w.id === incoming.id);
          return {
            widgets: exists
              ? s.widgets.map((w) => (w.id === incoming.id ? incoming : w))
              : [...s.widgets, incoming],
          };
        });
        return incoming.id;
      },

      remove: (id) => set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
    }),
    {
      name: "judie-custom-widgets",
      version: 1,
      partialize: (s) => ({ widgets: s.widgets }),
    }
  )
);

export function getCustomWidget(id: string | undefined | null): SlopDef | undefined {
  if (!id) return undefined;
  return useCustomWidgetStore.getState().widgets.find((w) => w.id === id);
}
