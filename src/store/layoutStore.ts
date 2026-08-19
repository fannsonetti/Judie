import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ExpandableWidgetType,
  WidgetInstance,
  WidgetSize,
  WidgetType,
  WIDGET_SUPPORTED_SIZES,
  PAGE_COUNT,
} from "../types/widgets";
import {
  createId,
  cycleSize,
  nextAvailableOrder,
  normalizeOrders,
  reorderWidgets,
} from "../lib/layout";

const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: "weather-1", type: "weather", page: 0, size: "2x2", order: 0 },
  { id: "lights-1", type: "lights", page: 0, size: "2x2", order: 1 },
  { id: "media-1", type: "media", page: 0, size: "1x2", order: 2 },
  { id: "calendar-1", type: "calendar", page: 0, size: "1x2", order: 3 },
  { id: "climate-1", type: "climate", page: 0, size: "1x1", order: 4 },
  { id: "purifier-1", type: "purifier", page: 0, size: "1x1", order: 5 },
  { id: "quick-1", type: "quickControls", page: 0, size: "1x2", order: 6 },

  { id: "server-1", type: "server", page: 1, size: "1x2", order: 0 },
  { id: "media-2", type: "media", page: 1, size: "2x2", order: 1 },
  { id: "climate-2", type: "climate", page: 1, size: "1x2", order: 2 },
  { id: "calendar-2", type: "calendar", page: 1, size: "2x2", order: 3 },

  { id: "weather-2", type: "weather", page: 2, size: "1x2", order: 0 },
  { id: "lights-2", type: "lights", page: 2, size: "1x2", order: 1 },
  { id: "purifier-2", type: "purifier", page: 2, size: "1x2", order: 2 },
  { id: "server-2", type: "server", page: 2, size: "1x1", order: 3 },
];

interface LayoutState {
  widgets: WidgetInstance[];
  currentPage: number;
  editMode: boolean;
  galleryOpen: boolean;
  expandedId: string | null;
  expandedType: ExpandableWidgetType | null;
  draggingId: string | null;

  setPage: (page: number) => void;
  enterEditMode: () => void;
  exitEditMode: () => void;
  setGalleryOpen: (open: boolean) => void;
  setDragging: (id: string | null) => void;

  expandWidget: (id: string, type: ExpandableWidgetType) => void;
  collapseWidget: () => void;

  reorder: (draggedId: string, targetId: string) => void;
  resizeWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  addWidget: (type: WidgetType, size: WidgetSize, page?: number) => void;
  moveWidgetToPage: (id: string, page: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      currentPage: 0,
      editMode: false,
      galleryOpen: false,
      expandedId: null,
      expandedType: null,
      draggingId: null,

      setPage: (page) =>
        set({ currentPage: Math.max(0, Math.min(PAGE_COUNT - 1, page)) }),

      enterEditMode: () =>
        set({ editMode: true, expandedId: null, expandedType: null }),

      exitEditMode: () => set({ editMode: false, galleryOpen: false, draggingId: null }),

      setGalleryOpen: (open) => set({ galleryOpen: open }),

      setDragging: (id) => set({ draggingId: id }),

      expandWidget: (id, type) => {
        if (get().editMode) return;
        set({ expandedId: id, expandedType: type });
      },

      collapseWidget: () => set({ expandedId: null, expandedType: null }),

      reorder: (draggedId, targetId) =>
        set((s) => ({
          widgets: normalizeOrders(reorderWidgets(s.widgets, draggedId, targetId)),
        })),

      resizeWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== id) return w;
            const supported = WIDGET_SUPPORTED_SIZES[w.type];
            return { ...w, size: cycleSize(w.size, supported) };
          }),
        })),

      removeWidget: (id) =>
        set((s) => ({
          widgets: normalizeOrders(s.widgets.filter((w) => w.id !== id)),
        })),

      addWidget: (type, size, page) =>
        set((s) => {
          const targetPage = page ?? s.currentPage;
          const supported = WIDGET_SUPPORTED_SIZES[type];
          const finalSize = supported.includes(size) ? size : supported[0];
          const widget: WidgetInstance = {
            id: createId(type),
            type,
            page: targetPage,
            size: finalSize,
            order: nextAvailableOrder(s.widgets, targetPage),
          };
          return { widgets: [...s.widgets, widget], galleryOpen: false };
        }),

      moveWidgetToPage: (id, page) =>
        set((s) => {
          const widgets = s.widgets.map((w) =>
            w.id === id
              ? { ...w, page, order: nextAvailableOrder(s.widgets, page) }
              : w
          );
          return { widgets: normalizeOrders(widgets) };
        }),
    }),
    {
      name: "nova-layout",
      version: 3,
      partialize: (s) => ({ widgets: s.widgets, currentPage: s.currentPage }),
      migrate: (persisted: unknown, version: number) => {
        if (version < 3) {
          return { widgets: DEFAULT_WIDGETS, currentPage: 0 };
        }
        return persisted as object;
      },
    }
  )
);
