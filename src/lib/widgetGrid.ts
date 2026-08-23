import { GRID_COLS, GRID_ROWS, SIZE_DIMS, WidgetSize } from "../types/widgets";

export const NOVA_FRAME = { w: 1920, h: 1200 };
export const NOVA_STATUS_H = 56;
export const NOVA_SAFE_BOTTOM = 20;
export const NOVA_PAGE_TOP = 4;

export interface GridMetrics {
  cellW: number;
  cellH: number;
  gap: number;
}

/** 6×4 home grid. Fills 16:9 and 16:10 (1920×1200) without clipping a full dashboard. */
export function measureWidgetGrid(width: number, height: number): GridMetrics {
  const gap = Math.max(12, Math.min(20, width * 0.012));
  const cellW = width / GRID_COLS;
  const cellH = height / GRID_ROWS;
  return { cellW, cellH, gap };
}

export function novaPagePad(frameW = NOVA_FRAME.w) {
  return Math.min(36, Math.max(16, frameW * 0.022));
}

/** Home-page content box on the default Judie tablet window. */
export function novaHomeGridMetrics(frame = NOVA_FRAME): GridMetrics {
  const pad = novaPagePad(frame.w);
  const width = frame.w - pad * 2;
  const height = frame.h - NOVA_STATUS_H - NOVA_PAGE_TOP - NOVA_SAFE_BOTTOM;
  return measureWidgetGrid(width, height);
}

/** Inner widget-shell size after slot padding — this is what the user sees. */
export function novaShellSize(size: WidgetSize, frame = NOVA_FRAME) {
  const metrics = novaHomeGridMetrics(frame);
  const dims = SIZE_DIMS[size];
  return {
    w: dims.cols * metrics.cellW - metrics.gap,
    h: dims.rows * metrics.cellH - metrics.gap,
  };
}
