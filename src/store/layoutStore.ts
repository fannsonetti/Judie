import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ExpandableWidgetType,
  WidgetInstance,
  WidgetSize,
  WidgetType,
  WIDGET_SUPPORTED_SIZES,
  MAX_PAGES,
} from "../types/widgets";
import {
  createId,
  cycleSize,
  nextAvailableOrder,
  normalizeOrders,
  reorderWidgets,
  visiblePageCount,
  usedPageCount,
} from "../lib/layout";
import { getCustomWidget } from "../store/customWidgetStore";
import { filledSizes } from "../slopbox/schema";

function sizesFor(type: WidgetType, customId?: string): WidgetSize[] {
  if (type === "custom") {
    const def = getCustomWidget(customId);
    if (def) return filledSizes(def);
    return [];
  }
  return WIDGET_SUPPORTED_SIZES[type];
}

const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: "weather-1", type: "weather", page: 0, size: "2x2", order: 0 },
  { id: "lights-1", type: "lights", page: 0, size: "2x2", order: 1 },
  { id: "media-1", type: "media", page: 0, size: "1x2", order: 2 },
  { id: "calendar-1", type: "calendar", page: 0, size: "1x2", order: 3 },
  { id: "climate-1", type: "climate", page: 0, size: "1x1", order: 4 },
  { id: "purifier-1", type: "purifier", page: 0, size: "1x1", order: 5 },
  { id: "quick-1", type: "quickControls", page: 0, size: "1x2", order: 6 },
];

interface LayoutState {
  widgets: WidgetInstance[];
  currentPage: number;
  editMode: boolean;
  galleryOpen: boolean;
  creatorOpen: boolean;
  expandedId: string | null;
  expandedType: ExpandableWidgetType | null;
  draggingId: string | null;

  setPage: (page: number) => void;
  enterEditMode: () => void;
  exitEditMode: () => void;
  setGalleryOpen: (open: boolean) => void;
  setCreatorOpen: (open: boolean) => void;
  setDragging: (id: string | null) => void;

  expandWidget: (id: string, type: ExpandableWidgetType) => void;
  collapseWidget: () => void;

  reorder: (draggedId: string, targetId: string) => void;
  resizeWidget: (id: string) => void;
  removeWidget: (id: string) => void;
  addWidget: (type: WidgetType, size: WidgetSize, page?: number, customId?: string) => void;
  moveWidgetToPage: (id: string, page: number) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      currentPage: 0,
      editMode: false,
      galleryOpen: false,
      creatorOpen: false,
      expandedId: null,
      expandedType: null,
      draggingId: null,

      setPage: (page) => {
        const max = Math.max(0, visiblePageCount(get().widgets, get().editMode) - 1);
        set({ currentPage: Math.max(0, Math.min(max, page)) });
      },

      enterEditMode: () =>
        set({ editMode: true, expandedId: null, expandedType: null }),

      exitEditMode: () => {
        const used = usedPageCount(get().widgets);
        set({
          editMode: false,
          galleryOpen: false,
          creatorOpen: false,
          draggingId: null,
          currentPage: Math.min(get().currentPage, Math.max(0, used - 1)),
        });
      },

      setGalleryOpen: (open) => set({ galleryOpen: open, ...(open ? { creatorOpen: false } : {}) }),

      setCreatorOpen: (open) =>
        set({ creatorOpen: open, ...(open ? { galleryOpen: false } : {}) }),

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
            const supported = sizesFor(w.type, w.customId);
            return { ...w, size: cycleSize(w.size, supported) };
          }),
        })),

      removeWidget: (id) =>
        set((s) => ({
          widgets: normalizeOrders(s.widgets.filter((w) => w.id !== id)),
        })),

      addWidget: (type, size, page, customId) =>
        set((s) => {
          const targetPage = Math.max(0, Math.min(MAX_PAGES - 1, page ?? s.currentPage));
          const supported = sizesFor(type, customId);
          if (!supported.length) return s;
          const finalSize = supported.includes(size) ? size : supported[0];
          const widget: WidgetInstance = {
            id: createId(type),
            type,
            page: targetPage,
            size: finalSize,
            order: nextAvailableOrder(s.widgets, targetPage),
            customId: type === "custom" ? customId : undefined,
          };
          return { widgets: [...s.widgets, widget], galleryOpen: false };
        }),

      moveWidgetToPage: (id, page) =>
        set((s) => {
          const target = Math.max(0, Math.min(MAX_PAGES - 1, page));
          const widgets = s.widgets.map((w) =>
            w.id === id
              ? { ...w, page: target, order: nextAvailableOrder(s.widgets, target) }
              : w
          );
          return { widgets: normalizeOrders(widgets) };
        }),
    }),
    {
      name: "judie-layout",
      version: 4,
      partialize: (s) => ({ widgets: s.widgets, currentPage: s.currentPage }),
      migrate: (persisted: unknown, version: number) => {
        if (version < 4) {
          const prev = persisted as { widgets?: WidgetInstance[]; currentPage?: number };
          const widgets = (prev.widgets ?? DEFAULT_WIDGETS).filter((w) => w.page === 0);
          return { widgets: widgets.length ? widgets : DEFAULT_WIDGETS, currentPage: 0 };
        }
        return persisted as object;
      },
    }
  )
);
