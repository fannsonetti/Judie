import { GRID_COLS, GRID_ROWS, SIZE_DIMS, WidgetSize } from "../types/widgets";

export const NOVA_FRAME = { w: 1920, h: 1200 };
export const NOVA_STATUS_H = 56;
export const NOVA_SAFE_BOTTOM = 20;
export const NOVA_PAGE_TOP = 4;

export interface GridMetrics {
  cellW: number;
  cellH: number;
  gap: number;
  /** Extra inset so square cells stay centered when height is the constraint. */
  offsetX: number;
  offsetY: number;
}

export interface FrameSize {
  w: number;
  h: number;
}

/**
 * 6×4 home grid with square cells. Uses the smaller axis so widgets keep a
 * fixed 1:1 cell ratio; leftover space becomes side (or vertical) padding.
 */
export function measureWidgetGrid(width: number, height: number): GridMetrics {
  const gap = Math.max(12, Math.min(20, width * 0.012));
  const cell = Math.min(width / GRID_COLS, height / GRID_ROWS);
  const gridW = cell * GRID_COLS;
  const gridH = cell * GRID_ROWS;
  return {
    cellW: cell,
    cellH: cell,
    gap,
    offsetX: Math.max(0, (width - gridW) / 2),
    offsetY: Math.max(0, (height - gridH) / 2),
  };
}

export function novaPagePad(frameW = NOVA_FRAME.w) {
  return Math.min(36, Math.max(16, frameW * 0.022));
}

/** Current window size, or the design tablet if there is no window yet. */
export function liveFrame(): FrameSize {
  if (typeof window === "undefined") return NOVA_FRAME;
  return { w: window.innerWidth, h: window.innerHeight };
}

/** Home-page content box on a Judie window. */
export function novaHomeGridMetrics(frame: FrameSize = NOVA_FRAME): GridMetrics {
  const pad = novaPagePad(frame.w);
  const width = frame.w - pad * 2;
  const height = frame.h - NOVA_STATUS_H - NOVA_PAGE_TOP - NOVA_SAFE_BOTTOM;
  return measureWidgetGrid(width, height);
}

/** Inner widget-shell size after slot padding — this is what the user sees. */
export function novaShellSize(size: WidgetSize, frame: FrameSize = NOVA_FRAME) {
  const metrics = novaHomeGridMetrics(frame);
  const dims = SIZE_DIMS[size];
  return {
    w: dims.cols * metrics.cellW - metrics.gap,
    h: dims.rows * metrics.cellH - metrics.gap,
  };
}

/** Prefer the live home grid so gallery previews match placed tiles exactly. */
export function liveShellSize(size: WidgetSize, frame: FrameSize = liveFrame()) {
  if (typeof document !== "undefined") {
    const grid = document.querySelector(".widget-grid");
    if (grid) {
      const r = grid.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        const metrics = measureWidgetGrid(r.width, r.height);
        const dims = SIZE_DIMS[size];
        return {
          w: dims.cols * metrics.cellW - metrics.gap,
          h: dims.rows * metrics.cellH - metrics.gap,
        };
      }
    }
  }
  return novaShellSize(size, frame);
}

/**
 * Scale that maps the 1920×1200 design widget onto the live home screen.
 * Editor zoom of 1 (100%) uses this so the canvas matches the home tiles.
 */
export function homeScaleFor(size: WidgetSize, frame: FrameSize = liveFrame()) {
  const live = novaShellSize(size, frame);
  const canon = novaShellSize(size, NOVA_FRAME);
  return Math.min(live.w / canon.w, live.h / canon.h);
}
