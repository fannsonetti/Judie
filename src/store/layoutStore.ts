import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ExpandableWidgetType,
  WidgetInstance,
  WidgetSize,
  WidgetType,
  WIDGET_SUPPORTED_SIZES,
  MAX_PAGES,
  GRID_ROWS,
} from "../types/widgets";
import {
  canPlaceWidget,
  createId,
  cycleSize,
  firstFreeCell,
  nearestPlace,
  nextAvailableOrder,
  normalizeOrders,
  packWidgets,
  placeWidgets,
  visiblePageCount,
  usedPageCount,
  withPlacedPositions,
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

const DEFAULT_WIDGETS: WidgetInstance[] = withPlacedPositions([
  { id: "weather-1", type: "weather", page: 0, size: "2x2", order: 0 },
  { id: "lights-1", type: "lights", page: 0, size: "2x2", order: 1 },
  { id: "media-1", type: "media", page: 0, size: "1x2", order: 2 },
  { id: "calendar-1", type: "calendar", page: 0, size: "1x1", order: 3 },
  { id: "climate-1", type: "climate", page: 0, size: "1x1", order: 4 },
  { id: "purifier-1", type: "purifier", page: 0, size: "1x1", order: 5 },
  { id: "quick-1", type: "quickControls", page: 0, size: "1x2", order: 6 },
]);

interface LayoutState {
  widgets: WidgetInstance[];
  currentPage: number;
  editMode: boolean;
  galleryOpen: boolean;
  creatorOpen: boolean;
  expandedId: string | null;
  expandedType: ExpandableWidgetType | null;
  draggingId: string | null;
  pendingRemoveId: string | null;

  setPage: (page: number) => void;
  enterEditMode: () => void;
  exitEditMode: () => void;
  setGalleryOpen: (open: boolean) => void;
  setCreatorOpen: (open: boolean) => void;
  setDragging: (id: string | null) => void;

  expandWidget: (id: string, type: ExpandableWidgetType) => void;
  collapseWidget: () => void;

  placeWidget: (id: string, col: number, row: number) => boolean;
  resizeWidget: (id: string) => void;
  requestRemoveWidget: (id: string) => void;
  confirmRemoveWidget: () => void;
  cancelRemoveWidget: () => void;
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
      pendingRemoveId: null,

      setPage: (page) => {
        const max = Math.max(0, visiblePageCount(get().widgets, get().editMode) - 1);
        set({ currentPage: Math.max(0, Math.min(max, page)) });
      },

      enterEditMode: () =>
        set({ editMode: true, expandedId: null, expandedType: null, pendingRemoveId: null }),

      exitEditMode: () => {
        const used = usedPageCount(get().widgets);
        set({
          editMode: false,
          galleryOpen: false,
          creatorOpen: false,
          draggingId: null,
          pendingRemoveId: null,
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

      placeWidget: (id, col, row) => {
        const { widgets } = get();
        const at = nearestPlace(widgets, id, col, row);
        if (!at) return false;
        set({
          widgets: widgets.map((w) => (w.id === id ? { ...w, col: at.col, row: at.row } : w)),
        });
        return true;
      },

      resizeWidget: (id) =>
        set((s) => {
          const target = s.widgets.find((w) => w.id === id);
          if (!target) return s;
          const supported = sizesFor(target.type, target.customId);
          const nextSize = cycleSize(target.size, supported);
          if (nextSize === target.size) return s;

          const col = target.col ?? 0;
          const row = target.row ?? 0;
          if (canPlaceWidget(s.widgets, id, col, row, nextSize)) {
            return {
              widgets: s.widgets.map((w) => (w.id === id ? { ...w, size: nextSize } : w)),
            };
          }

          const free = firstFreeCell(
            s.widgets.filter((w) => w.id !== id),
            nextSize,
            target.page,
            GRID_ROWS
          );
          if (!free) return s;
          return {
            widgets: s.widgets.map((w) =>
              w.id === id ? { ...w, size: nextSize, col: free.col, row: free.row } : w
            ),
          };
        }),

      requestRemoveWidget: (id) => set({ pendingRemoveId: id }),

      cancelRemoveWidget: () => set({ pendingRemoveId: null }),

      confirmRemoveWidget: () => {
        const id = get().pendingRemoveId;
        if (!id) return;
        set((s) => ({
          pendingRemoveId: null,
          widgets: normalizeOrders(s.widgets.filter((w) => w.id !== id)),
        }));
      },

      removeWidget: (id) =>
        set((s) => ({
          pendingRemoveId: s.pendingRemoveId === id ? null : s.pendingRemoveId,
          widgets: normalizeOrders(s.widgets.filter((w) => w.id !== id)),
        })),

      addWidget: (type, size, page, customId) =>
        set((s) => {
          const targetPage = Math.max(0, Math.min(MAX_PAGES - 1, page ?? s.currentPage));
          const supported = sizesFor(type, customId);
          if (!supported.length) return s;
          const finalSize = supported.includes(size) ? size : supported[0];
          const free = firstFreeCell(s.widgets, finalSize, targetPage, GRID_ROWS);
          if (!free) return s;
          const widget: WidgetInstance = {
            id: createId(type),
            type,
            page: targetPage,
            size: finalSize,
            order: nextAvailableOrder(s.widgets, targetPage),
            col: free.col,
            row: free.row,
            customId: type === "custom" ? customId : undefined,
          };
          return { widgets: [...s.widgets, widget], galleryOpen: false };
        }),

      moveWidgetToPage: (id, page) =>
        set((s) => {
          const target = Math.max(0, Math.min(MAX_PAGES - 1, page));
          const widget = s.widgets.find((w) => w.id === id);
          if (!widget) return s;
          const others = s.widgets.filter((w) => w.id !== id);
          const free = firstFreeCell(others, widget.size, target, GRID_ROWS);
          if (!free) return s;
          const widgets = s.widgets.map((w) =>
            w.id === id
              ? {
                  ...w,
                  page: target,
                  order: nextAvailableOrder(others, target),
                  col: free.col,
                  row: free.row,
                }
              : w
          );
          return { widgets: normalizeOrders(widgets) };
        }),
    }),
    {
      name: "judie-layout",
      version: 6,
      partialize: (s) => ({ widgets: s.widgets, currentPage: s.currentPage }),
      migrate: (persisted: unknown, version: number) => {
        const prev = persisted as { widgets?: WidgetInstance[]; currentPage?: number };
        let widgets = prev.widgets ?? DEFAULT_WIDGETS;
        if (version < 4) {
          widgets = widgets.filter((w) => w.page === 0);
          if (!widgets.length) widgets = DEFAULT_WIDGETS;
        }
        if (version < 5) {
          // Convert order-packed layouts into explicit cells so empty gaps stay.
          const byPage = new Map<number, WidgetInstance[]>();
          for (const w of widgets) {
            const list = byPage.get(w.page) ?? [];
            list.push(w);
            byPage.set(w.page, list);
          }
          widgets = [];
          for (const [, list] of byPage) {
            const packed = packWidgets(list, GRID_ROWS);
            widgets.push(
              ...packed.map((p) => ({
                ...list.find((w) => w.id === p.id)!,
                col: p.col,
                row: p.row,
              }))
            );
          }
        }
        if (version < 6) {
          widgets = widgets
            .filter((w) => (w.type as string) !== "trends")
            .map((w) =>
              w.type === "calendar" && w.size === "1x2" ? { ...w, size: "1x1" as const } : w
            );
        }
        return {
          widgets: withPlacedPositions(widgets),
          currentPage: prev.currentPage ?? 0,
        };
      },
    }
  )
);

/** Placed widgets for the current page (for grids / previews). */
export function placedForPage(widgets: WidgetInstance[], page: number) {
  return placeWidgets(widgets.filter((w) => w.page === page));
}
