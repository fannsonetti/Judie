import { GRID_COLS, GRID_ROWS } from "../types/widgets";

/** Pointer delta from the press point. Used so a lift into the drag layer does not jump. */
export function dragOffset(
  pressX: number,
  pressY: number,
  pointerX: number,
  pointerY: number
) {
  return { dx: pointerX - pressX, dy: pointerY - pressY };
}

/** Nearest grid origin for a free drag, clamped to the usable home grid. */
export function dropCell(
  fromCol: number,
  fromRow: number,
  dx: number,
  dy: number,
  cell: number,
  spanCols: number,
  spanRows: number,
  gridCols = GRID_COLS,
  gridRows = GRID_ROWS
) {
  return {
    col: Math.max(0, Math.min(gridCols - spanCols, Math.round(fromCol + dx / cell))),
    row: Math.max(0, Math.min(gridRows - spanRows, Math.round(fromRow + dy / cell))),
  };
}

/** Visual leftover after the slot jumps to `to` so the layer can glide into place. */
export function leftoverDelta(
  dx: number,
  dy: number,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  cell: number
) {
  return {
    dx: dx - (toCol - fromCol) * cell,
    dy: dy - (toRow - fromRow) * cell,
  };
}
