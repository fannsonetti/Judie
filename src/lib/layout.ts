import {
  GRID_COLS,
  SIZE_DIMS,
  WidgetInstance,
  WidgetSize,
  PlacedWidget,
  MAX_PAGES,
} from "../types/widgets";

export function sizeDims(size: WidgetSize) {
  return SIZE_DIMS[size];
}

function fits(
  occupied: boolean[][],
  row: number,
  col: number,
  w: number,
  h: number,
  maxRows: number
): boolean {
  if (col + w > GRID_COLS) return false;
  if (row + h > maxRows) return false;
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (occupied[r]?.[c]) return false;
    }
  }
  return true;
}

function mark(
  occupied: boolean[][],
  row: number,
  col: number,
  w: number,
  h: number
) {
  for (let r = row; r < row + h; r++) {
    if (!occupied[r]) occupied[r] = Array(GRID_COLS).fill(false);
    for (let c = col; c < col + w; c++) {
      occupied[r][c] = true;
    }
  }
}

/** Pack ordered widgets into grid cells. Positions are computed, never stored. */
export function packWidgets(widgets: WidgetInstance[]): PlacedWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const occupied: boolean[][] = [];
  const placed: PlacedWidget[] = [];
  const maxRows = 40;

  for (const widget of sorted) {
    const { cols: w, rows: h } = sizeDims(widget.size);
    let found = false;

    for (let row = 0; row < maxRows && !found; row++) {
      if (!occupied[row]) occupied[row] = Array(GRID_COLS).fill(false);
      for (let col = 0; col <= GRID_COLS - w; col++) {
        if (fits(occupied, row, col, w, h, maxRows)) {
          mark(occupied, row, col, w, h);
          placed.push({ ...widget, col, row });
          found = true;
          break;
        }
      }
    }
  }

  return placed;
}

export function nextAvailableOrder(widgets: WidgetInstance[], page: number): number {
  const pageWidgets = widgets.filter((w) => w.page === page);
  if (pageWidgets.length === 0) return 0;
  return Math.max(...pageWidgets.map((w) => w.order)) + 1;
}

export function normalizeOrders(widgets: WidgetInstance[]): WidgetInstance[] {
  const byPage = new Map<number, WidgetInstance[]>();
  for (const w of widgets) {
    const list = byPage.get(w.page) ?? [];
    list.push(w);
    byPage.set(w.page, list);
  }

  const result: WidgetInstance[] = [];
  for (const [, list] of byPage) {
    list
      .sort((a, b) => a.order - b.order)
      .forEach((w, i) => result.push({ ...w, order: i }));
  }
  return result;
}

/** Reorder: move draggedId so it takes the order slot of targetId on the same page. */
export function reorderWidgets(
  widgets: WidgetInstance[],
  draggedId: string,
  targetId: string
): WidgetInstance[] {
  if (draggedId === targetId) return widgets;
  const dragged = widgets.find((w) => w.id === draggedId);
  const target = widgets.find((w) => w.id === targetId);
  if (!dragged || !target || dragged.page !== target.page) return widgets;

  const page = dragged.page;
  const pageWidgets = widgets
    .filter((w) => w.page === page)
    .sort((a, b) => a.order - b.order);
  const others = widgets.filter((w) => w.page !== page);

  const without = pageWidgets.filter((w) => w.id !== draggedId);
  const targetIndex = without.findIndex((w) => w.id === targetId);
  if (targetIndex < 0) return widgets;

  // Insert before target if dragging from later, or at target index
  const draggedFrom = pageWidgets.findIndex((w) => w.id === draggedId);
  const insertAt =
    draggedFrom < target.order ? targetIndex + 1 : targetIndex;

  without.splice(Math.min(insertAt, without.length), 0, dragged);

  const reordered = without.map((w, i) => ({ ...w, order: i }));
  return [...others, ...reordered];
}

export function cycleSize(
  current: WidgetSize,
  supported: WidgetSize[]
): WidgetSize {
  if (supported.length <= 1) return current;
  const idx = supported.indexOf(current);
  return supported[(idx + 1) % supported.length];
}

export function createId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 9)}`;
}

export function usedPageCount(widgets: WidgetInstance[]): number {
  if (widgets.length === 0) return 1;
  return Math.max(...widgets.map((w) => w.page), 0) + 1;
}

/** Extra empty page only while editing, so you can add another screen on purpose. */
export function visiblePageCount(widgets: WidgetInstance[], editMode: boolean): number {
  const used = usedPageCount(widgets);
  if (editMode && used < MAX_PAGES) return used + 1;
  return used;
}
