import {
  GRID_COLS,
  GRID_ROWS,
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
  if (col < 0 || row < 0) return false;
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

function ensureRows(occupied: boolean[][], maxRows: number) {
  for (let row = 0; row < maxRows; row++) {
    if (!occupied[row]) occupied[row] = Array(GRID_COLS).fill(false);
  }
}

function findFirstFit(
  occupied: boolean[][],
  w: number,
  h: number,
  maxRows: number
): { col: number; row: number } | null {
  ensureRows(occupied, maxRows);
  for (let row = 0; row < maxRows; row++) {
    for (let col = 0; col <= GRID_COLS - w; col++) {
      if (fits(occupied, row, col, w, h, maxRows)) {
        return { col, row };
      }
    }
  }
  return null;
}

/**
 * Place widgets onto the grid. Stored col/row are preferred when they fit
 * without overlap, so empty cells can stay empty. Missing/invalid positions
 * pack into the first free slot.
 */
export function placeWidgets(
  widgets: WidgetInstance[],
  maxRows: number = GRID_ROWS
): PlacedWidget[] {
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  const occupied: boolean[][] = [];
  const placed: PlacedWidget[] = [];
  ensureRows(occupied, maxRows);

  for (const widget of sorted) {
    const { cols: w, rows: h } = sizeDims(widget.size);
    const preferred =
      typeof widget.col === "number" &&
      typeof widget.row === "number" &&
      fits(occupied, widget.row, widget.col, w, h, maxRows)
        ? { col: widget.col, row: widget.row }
        : findFirstFit(occupied, w, h, maxRows);

    if (!preferred) continue;
    mark(occupied, preferred.row, preferred.col, w, h);
    placed.push({ ...widget, col: preferred.col, row: preferred.row });
  }

  return placed;
}

/** Auto-pack left-to-right / top-to-bottom (ignores stored col/row). */
export function packWidgets(
  widgets: WidgetInstance[],
  maxRows: number = 40
): PlacedWidget[] {
  const cleared = widgets.map((w) => {
    const { col: _c, row: _r, ...rest } = w;
    return rest as WidgetInstance;
  });
  return placeWidgets(cleared, maxRows);
}

export function canPlaceWidget(
  widgets: WidgetInstance[],
  id: string,
  col: number,
  row: number,
  size?: WidgetSize,
  maxRows: number = GRID_ROWS
): boolean {
  const widget = widgets.find((w) => w.id === id);
  if (!widget) return false;
  const { cols: w, rows: h } = sizeDims(size ?? widget.size);
  const occupied: boolean[][] = [];
  ensureRows(occupied, maxRows);

  for (const other of widgets) {
    if (other.id === id) continue;
    if (typeof other.col !== "number" || typeof other.row !== "number") continue;
    const dims = sizeDims(other.size);
    mark(occupied, other.row, other.col, dims.cols, dims.rows);
  }

  return fits(occupied, row, col, w, h, maxRows);
}

export function firstFreeCell(
  widgets: WidgetInstance[],
  size: WidgetSize,
  page: number,
  maxRows: number = GRID_ROWS
): { col: number; row: number } | null {
  const occupied: boolean[][] = [];
  ensureRows(occupied, maxRows);
  const { cols: w, rows: h } = sizeDims(size);

  for (const other of widgets.filter((x) => x.page === page)) {
    if (typeof other.col !== "number" || typeof other.row !== "number") continue;
    const dims = sizeDims(other.size);
    mark(occupied, other.row, other.col, dims.cols, dims.rows);
  }

  return findFirstFit(occupied, w, h, maxRows);
}

/** Snap stored positions from a placed layout (migration / normalize). */
export function withPlacedPositions(widgets: WidgetInstance[]): WidgetInstance[] {
  const byPage = new Map<number, WidgetInstance[]>();
  for (const w of widgets) {
    const list = byPage.get(w.page) ?? [];
    list.push(w);
    byPage.set(w.page, list);
  }

  const result: WidgetInstance[] = [];
  for (const [, list] of byPage) {
    const placed = placeWidgets(list);
    const byId = new Map(placed.map((p) => [p.id, p]));
    for (const w of list.sort((a, b) => a.order - b.order)) {
      const p = byId.get(w.id);
      if (p) result.push({ ...w, col: p.col, row: p.row });
    }
  }
  return result;
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

  const draggedFrom = pageWidgets.findIndex((w) => w.id === draggedId);
  const insertAt = draggedFrom < target.order ? targetIndex + 1 : targetIndex;

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
