import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WidgetSize } from "../types/widgets";
import { createId, filledSizes, nodesFor, withLayout, SlopDef, SlopNode } from "./schema";
import { makeFromTemplate } from "./templates";

interface SlopState {
  widgets: SlopDef[];
  selectedId: string | null;
  create: (templateId?: string) => string;
  duplicate: (id: string) => string | null;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  select: (id: string | null) => void;
  patch: (id: string, patch: Partial<SlopDef>) => void;
  setSizes: (id: string, sizes: WidgetSize[]) => void;
  setNodes: (id: string, size: WidgetSize, nodes: SlopNode[]) => void;
  copyLayout: (id: string, from: WidgetSize, to: WidgetSize) => void;
  importOne: (def: SlopDef) => string;
}

function seed(): SlopDef[] {
  const stat = makeFromTemplate("stat");
  stat.name = "Room pulse";
  return [stat];
}

export const useSlopStore = create<SlopState>()(
  persist(
    (set, get) => ({
      widgets: seed(),
      selectedId: null,

      create: (templateId = "blank") => {
        const widget = makeFromTemplate(templateId);
        set((s) => ({
          widgets: [...s.widgets, widget],
          selectedId: widget.id,
        }));
        return widget.id;
      },

      duplicate: (id) => {
        const src = get().widgets.find((w) => w.id === id);
        if (!src) return null;
        const copy: SlopDef = {
          ...structuredClone(src),
          id: createId("slop"),
          name: `${src.name} copy`,
        };
        set((s) => ({ widgets: [...s.widgets, copy], selectedId: copy.id }));
        return copy.id;
      },

      remove: (id) =>
        set((s) => {
          const widgets = s.widgets.filter((w) => w.id !== id);
          return {
            widgets,
            selectedId: s.selectedId === id ? (widgets[0]?.id ?? null) : s.selectedId,
          };
        }),

      rename: (id, name) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, name: name.trim() || w.name } : w
          ),
        })),

      select: (id) => set({ selectedId: id }),

      patch: (id, patch) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),

      setSizes: (id, sizes) =>
        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== id) return w;
            const next = sizes.length ? sizes : (["1x1"] as WidgetSize[]);
            return { ...w, sizes: next };
          }),
        })),

      setNodes: (id, size, nodes) =>
        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== id) return w;
            const layouts = withLayout(w.layouts, size, nodes);
            return { ...w, layouts, sizes: filledSizes({ ...w, layouts }) };
          }),
        })),

      copyLayout: (id, from, to) =>
        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== id) return w;
            const nodes = structuredClone(nodesFor(w, from)).map((n) => ({
              ...n,
              id: createId(),
            }));
            const layouts = withLayout(w.layouts, to, nodes);
            return { ...w, layouts, sizes: filledSizes({ ...w, layouts }) };
          }),
        })),

      importOne: (def) => {
        const incoming: SlopDef = { ...structuredClone(def), id: def.id || createId("widget") };
        set((s) => {
          const exists = s.widgets.some((w) => w.id === incoming.id);
          return {
            widgets: exists
              ? s.widgets.map((w) => (w.id === incoming.id ? incoming : w))
              : [...s.widgets, incoming],
            selectedId: incoming.id,
          };
        });
        return incoming.id;
      },
    }),
    {
      name: "judie-widget-creator",
      version: 1,
      partialize: (s) => ({ widgets: s.widgets, selectedId: s.selectedId }),
    }
  )
);

export function getSlopWidget(id: string | undefined | null): SlopDef | undefined {
  if (!id) return undefined;
  return useSlopStore.getState().widgets.find((w) => w.id === id);
}
