import { WidgetSize } from "../types/widgets";
import { novaShellSize } from "../lib/widgetGrid";

export type SlopKind =
  | "text"
  | "metric"
  | "icon"
  | "bar"
  | "gauge"
  | "button"
  | "chip"
  | "divider"
  | "box"
  | "list"
  | "pair"
  | "toggle"
  | "chart";

export type SlopAlign = "left" | "center" | "right";
export type SlopValign = "top" | "middle" | "bottom";

export interface SlopNode {
  id: string;
  kind: SlopKind;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  color?: string;
  opacity?: number;
  align?: SlopAlign;
  valign?: SlopValign;
  icon?: string;
  fill?: string;
  radius?: number;
  value?: number;
  accent?: string;
  /** Invisible on the widget. Present in export so each part can be hooked up. */
  descriptor?: string;
  /** Longer hook note for export comments. Not drawn on the widget. */
  hook?: string;
  /** Inline SVG markup for custom icons. */
  svg?: string;
}

export interface SlopDef {
  id: string;
  name: string;
  sizes: WidgetSize[];
  background?: string;
  accent?: string;
  layouts: Partial<Record<WidgetSize, SlopNode[]>>;
}

export const CANONICAL: Record<WidgetSize, { w: number; h: number }> = {
  "1x1": novaShellSize("1x1"),
  "1x2": novaShellSize("1x2"),
  "2x2": novaShellSize("2x2"),
};

export const SLOP_KINDS: { kind: SlopKind; label: string }[] = [
  { kind: "text", label: "Text" },
  { kind: "metric", label: "Value" },
  { kind: "icon", label: "Icon" },
  { kind: "bar", label: "Bar" },
  { kind: "gauge", label: "Status" },
  { kind: "button", label: "Button" },
  { kind: "chip", label: "Chip" },
  { kind: "list", label: "List" },
  { kind: "pair", label: "Pair" },
  { kind: "toggle", label: "Control" },
  { kind: "chart", label: "Graph" },
  { kind: "divider", label: "Divider" },
  { kind: "box", label: "Container" },
];

export const SLOP_SWATCHES = [
  "#f4f5f7",
  "#8b909d",
  "#5c6170",
  "#ffffff",
  "#3dd68c",
  "#ff5c5c",
  "#FF9F0A",
  "#AF52DE",
  "#FFD166",
  "#72B043",
  "#ffffff",
];

export const DEFAULT_CHART_SERIES = "18, 24, 21, 38, 34, 52, 47, 61, 55, 72, 66, 78";

export function chartSeries(text?: string): number[] {
  const parsed = (text ?? "")
    .split(/[, \n]+/)
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n));
  if (parsed.length >= 2) return parsed;
  return [18, 24, 21, 38, 34, 52, 47, 61, 55, 72, 66, 78];
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function clampPct(n: number, min = 0, max = 100) {
  return clamp(n, min, max);
}

export function snapPct(n: number, step = 0.5) {
  return Math.round(n / step) * step;
}

export const EDITOR_GRID_PX = 8;

export function snapPx(n: number, grid = EDITOR_GRID_PX) {
  return Math.round(n / grid) * grid;
}

export function snapBoxToGrid(
  box: { x: number; y: number; w: number; h: number },
  shell: { w: number; h: number },
  grid = EDITOR_GRID_PX
) {
  let x = snapPx((box.x / 100) * shell.w, grid);
  let y = snapPx((box.y / 100) * shell.h, grid);
  let w = Math.max(grid, snapPx((box.w / 100) * shell.w, grid));
  let h = Math.max(grid, snapPx((box.h / 100) * shell.h, grid));
  x = clamp(x, 0, Math.max(0, shell.w - grid));
  y = clamp(y, 0, Math.max(0, shell.h - grid));
  w = clamp(w, grid, Math.max(grid, shell.w - x));
  h = clamp(h, grid, Math.max(grid, shell.h - y));
  return {
    ...box,
    x: (x / shell.w) * 100,
    y: (y / shell.h) * 100,
    w: (w / shell.w) * 100,
    h: (h / shell.h) * 100,
  };
}

export function createId(prefix = "n") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const KIND_DEFAULTS: Record<
  SlopKind,
  Omit<SlopNode, "id" | "kind" | "x" | "y">
> = {
  text: {
    w: 22,
    h: 8,
    text: "Label",
    fontSize: 13,
    fontWeight: 600,
    color: "#8b909d",
    align: "left",
    valign: "top",
  },
  metric: {
    w: 72,
    h: 22,
    text: "72",
    fontSize: 44,
    fontWeight: 650,
    color: "#f4f5f7",
    align: "left",
    valign: "top",
    letterSpacing: -1.2,
  },
  icon: {
    w: 14,
    h: 14,
    icon: "spark",
    color: "#ffffff",
  },
  bar: {
    w: 78,
    h: 5,
    value: 62,
    accent: "#ffffff",
    fill: "rgba(255,255,255,0.08)",
    radius: 99,
  },
  gauge: {
    w: 34,
    h: 34,
    value: 72,
    accent: "#ffffff",
    text: "72",
    color: "#f4f5f7",
    fontSize: 16,
  },
  button: {
    w: 30,
    h: 14,
    text: "Action",
    fontSize: 13,
    fontWeight: 600,
    color: "#ffffff",
    fill: "#ffffff",
    radius: 12,
    align: "center",
    valign: "middle",
  },
  chip: {
    w: 24,
    h: 11,
    text: "Chip",
    fontSize: 12,
    fontWeight: 550,
    color: "#f4f5f7",
    fill: "rgba(255,255,255,0.08)",
    radius: 99,
    align: "center",
    valign: "middle",
  },
  divider: {
    w: 88,
    h: 0.6,
    fill: "rgba(255,255,255,0.1)",
    radius: 99,
  },
  box: {
    w: 40,
    h: 28,
    fill: "rgba(255,255,255,0.05)",
    radius: 16,
  },
  list: {
    w: 88,
    h: 36,
    text: "Living room\nKitchen\nBedroom",
    fontSize: 13,
    fontWeight: 550,
    color: "#f4f5f7",
    align: "left",
    valign: "middle",
  },
  pair: {
    w: 88,
    h: 14,
    text: "Humidity\n42%",
    fontSize: 13,
    fontWeight: 550,
    color: "#8b909d",
    align: "left",
    valign: "middle",
  },
  toggle: {
    w: 18,
    h: 10,
    value: 100,
    accent: "#ffffff",
    fill: "rgba(255,255,255,0.14)",
    radius: 99,
  },
  chart: {
    w: 84,
    h: 22,
    text: DEFAULT_CHART_SERIES,
    accent: "#3dd68c",
  },
};

export const ALL_WIDGET_SIZES: WidgetSize[] = ["1x1", "1x2", "2x2"];

export function isTextLike(kind: SlopKind) {
  return kind === "text" || kind === "metric";
}

function measureTextPx(text: string, font: string): { w: number; h: number } {
  const sample = text.length ? text : " ";
  if (typeof document !== "undefined") {
    textMeasureCanvas ??= document.createElement("canvas");
    const ctx = textMeasureCanvas.getContext("2d");
    if (ctx) {
      ctx.font = font;
      const m = ctx.measureText(sample);
      const ascent = m.actualBoundingBoxAscent ?? 0;
      const descent = m.actualBoundingBoxDescent ?? 0;
      const h = ascent + descent;
      const sizeMatch = /([\d.]+)px/.exec(font);
      const fallbackH = sizeMatch ? Number(sizeMatch[1]) : 13;
      return { w: m.width, h: h > 1 ? h : fallbackH };
    }
  }
  const sizeMatch = /([\d.]+)px/.exec(font);
  const size = sizeMatch ? Number(sizeMatch[1]) : 13;
  return { w: Math.max(size, sample.length * size * 0.62), h: size };
}

let textMeasureCanvas: HTMLCanvasElement | null = null;

export function fitTextNode(node: SlopNode, shell: { w: number; h: number }): SlopNode {
  if (!isTextLike(node.kind)) return node;
  const fontSize = node.fontSize ?? (node.kind === "metric" ? 44 : 13);
  const weight = node.fontWeight ?? (node.kind === "metric" ? 650 : 600);
  const tracking = node.letterSpacing ?? (node.kind === "metric" ? -1.2 : 0);
  const font = `${weight} ${fontSize}px Inter, Geist, "Segoe UI", sans-serif`;
  const lines = (node.text ?? "").split("\n");
  let maxW = 0;
  for (const line of lines) {
    const { w } = measureTextPx(line, font);
    const extra = Math.max(0, (line.length - 1) * tracking);
    maxW = Math.max(maxW, w + extra);
  }
  const lineH = node.kind === "metric" ? fontSize * 1.02 : fontSize * 1.2;
  const wPx = Math.max(EDITOR_GRID_PX, maxW + 8);
  const hPx = Math.max(EDITOR_GRID_PX, lineH * Math.max(1, lines.length) + 4);
  return {
    ...node,
    ...snapBoxToGrid({ ...node, w: (wPx / shell.w) * 100, h: (hPx / shell.h) * 100 }, shell),
  };
}

export function hitBox(node: SlopNode, shell: { w: number; h: number }): SlopNode {
  if (!isTextLike(node.kind)) return node;
  const fitted = fitTextNode(node, shell);
  if (node.kind === "metric") return { ...node, w: fitted.w, h: fitted.h };
  const oneLine = !(node.text ?? "").includes("\n");
  if (oneLine && node.w > fitted.w * 1.25) {
    return { ...node, w: fitted.w, h: fitted.h };
  }
  return { ...node, h: Math.max(fitted.h, Math.min(node.h, fitted.h * 1.35)) };
}

export function defaultNode(kind: SlopKind, x = 8, y = 8, shell = CANONICAL["1x1"]): SlopNode {
  const node: SlopNode = { id: createId(), kind, x, y, ...KIND_DEFAULTS[kind] };
  return isTextLike(kind) ? fitTextNode(node, shell) : node;
}

export function nodesFor(def: SlopDef, size: WidgetSize): SlopNode[] {
  return (def.layouts[size] ?? []).map((n) => ({ ...n }));
}

export function cloneLayouts(layouts: SlopDef["layouts"] = {}): SlopDef["layouts"] {
  return {
    "1x1": (layouts["1x1"] ?? []).map((n) => ({ ...n })),
    "1x2": (layouts["1x2"] ?? []).map((n) => ({ ...n })),
    "2x2": (layouts["2x2"] ?? []).map((n) => ({ ...n })),
  };
}

export function withLayout(
  layouts: SlopDef["layouts"],
  size: WidgetSize,
  nodes: SlopNode[]
): SlopDef["layouts"] {
  const next = cloneLayouts(layouts);
  next[size] = nodes.map((n) => ({ ...n }));
  return next;
}

export function filledSizes(def: SlopDef): WidgetSize[] {
  return ALL_WIDGET_SIZES.filter((s) => (def.layouts[s]?.length ?? 0) > 0);
}

export function emptyLayouts(): SlopDef["layouts"] {
  return { "1x1": [], "1x2": [], "2x2": [] };
}

export function scaleFor(size: WidgetSize, width: number, height: number) {
  const canon = CANONICAL[size];
  return Math.min(width / canon.w, height / canon.h);
}

export function nudgeNodePx(
  node: SlopNode,
  dxPx: number,
  dyPx: number,
  shell: { w: number; h: number }
): SlopNode {
  const next = {
    ...node,
    x: (((node.x / 100) * shell.w + dxPx) / shell.w) * 100,
    y: (((node.y / 100) * shell.h + dyPx) / shell.h) * 100,
  };
  return { ...node, ...snapBoxToGrid(next, shell) };
}

export function moveNode(node: SlopNode, dx: number, dy: number): SlopNode {
  return {
    ...node,
    x: clampPct(node.x + dx, 0, 100 - node.w),
    y: clampPct(node.y + dy, 0, 100 - node.h),
  };
}

export function resizeNode(
  node: SlopNode,
  next: { x?: number; y?: number; w?: number; h?: number }
): SlopNode {
  const x = clampPct(next.x ?? node.x);
  const y = clampPct(next.y ?? node.y);
  const w = clampPct(next.w ?? node.w, 1, 100 - x);
  const h = clampPct(next.h ?? node.h, 0.4, 100 - y);
  return { ...node, x, y, w, h };
}

export function duplicateNode(node: SlopNode): SlopNode {
  return {
    ...node,
    id: createId(),
    x: clampPct(node.x + 3, 0, 100 - node.w),
    y: clampPct(node.y + 3, 0, 100 - node.h),
  };
}
