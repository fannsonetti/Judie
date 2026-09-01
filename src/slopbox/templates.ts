import { WidgetSize } from "../types/widgets";
import {
  ALL_WIDGET_SIZES,
  CANONICAL,
  createId,
  defaultNode,
  emptyLayouts,
  filledSizes,
  fitTextNode,
  isTextLike,
  SlopDef,
  SlopNode,
} from "./schema";

function n(kind: SlopNode["kind"], extra: Partial<SlopNode>): SlopNode {
  return { ...defaultNode(kind), ...extra, id: createId(), kind };
}

function def(
  name: string,
  _sizes: WidgetSize[],
  layouts: SlopDef["layouts"],
  extra?: Partial<SlopDef>
): SlopDef {
  const next = { ...emptyLayouts(), ...layouts };
  for (const size of ALL_WIDGET_SIZES) {
    next[size] = (next[size] ?? []).map((node) =>
      isTextLike(node.kind) ? fitTextNode(node, CANONICAL[size]) : node
    );
  }
  const widget: SlopDef = {
    id: createId("slop"),
    name,
    layouts: next,
    sizes: filledSizes({ id: "", name, sizes: [], layouts: next }),
    ...extra,
  };
  return widget;
}

export const TEMPLATES: { id: string; label: string; hint: string; make: () => SlopDef }[] = [
  {
    id: "blank",
    label: "Blank",
    hint: "Empty canvas",
    make: () => def("Untitled", ["1x1", "1x2", "2x2"], emptyLayouts()),
  },
  {
    id: "stat",
    label: "Number",
    hint: "Big number + label",
    make: () =>
      def("Stat", ["1x1", "1x2", "2x2"], {
        "1x1": [
          n("text", { x: 8, y: 8, w: 70, h: 10, text: "INDOOR", descriptor: "climate.label" }),
          n("metric", {
            x: 8,
            y: 28,
            w: 84,
            h: 36,
            text: "21°",
            descriptor: "climate.indoorTemp",
            hook: "Indoor temperature, including the degree suffix.",
          }),
          n("text", {
            x: 8,
            y: 72,
            w: 80,
            h: 12,
            text: "Comfortable",
            fontSize: 13,
            color: "#8b909d",
            fontWeight: 500,
            descriptor: "climate.comfort",
            hook: "Comfort label from indoor climate.",
          }),
        ],
        "1x2": [
          n("text", { x: 5, y: 10, w: 30, h: 12, text: "INDOOR", descriptor: "climate.label" }),
          n("metric", {
            x: 5,
            y: 32,
            w: 40,
            h: 40,
            text: "21°",
            descriptor: "climate.indoorTemp",
            hook: "Indoor temperature, including the degree suffix.",
          }),
          n("text", {
            x: 5,
            y: 74,
            w: 36,
            h: 14,
            text: "Comfortable",
            fontSize: 13,
            color: "#8b909d",
            fontWeight: 500,
            descriptor: "climate.comfort",
          }),
          n("bar", {
            x: 48,
            y: 44,
            w: 46,
            h: 8,
            value: 42,
            descriptor: "climate.humidity",
            hook: "Humidity 0–100 for the fill bar.",
          }),
          n("text", {
            x: 48,
            y: 58,
            w: 46,
            h: 12,
            text: "Humidity 42%",
            fontSize: 12,
            color: "#8b909d",
            descriptor: "climate.humidityLabel",
          }),
        ],
        "2x2": [
          n("text", { x: 6, y: 6, w: 50, h: 7, text: "INDOOR" }),
          n("metric", { x: 6, y: 16, w: 55, h: 20, text: "21.4°" }),
          n("text", {
            x: 6,
            y: 38,
            w: 50,
            h: 6,
            text: "Comfortable · 42% humidity",
            fontSize: 13,
            color: "#8b909d",
            fontWeight: 500,
          }),
          n("bar", { x: 6, y: 50, w: 88, h: 4, value: 42 }),
          n("chip", { x: 6, y: 64, w: 22, h: 10, text: "Auto" }),
          n("chip", { x: 30, y: 64, w: 22, h: 10, text: "Quiet" }),
          n("chip", { x: 54, y: 64, w: 22, h: 10, text: "Boost" }),
        ],
      }),
  },
  {
    id: "status",
    label: "Status",
    hint: "Title, gauge, note",
    make: () =>
      def("Status", ["1x1", "1x2", "2x2"], {
        "1x1": [
          n("text", { x: 8, y: 7, w: 80, h: 10, text: "AIR" }),
          n("gauge", { x: 28, y: 22, w: 44, h: 44, value: 76, text: "76" }),
          n("text", {
            x: 8,
            y: 78,
            w: 84,
            h: 12,
            text: "Good",
            align: "center",
            color: "#3dd68c",
            fontSize: 14,
          }),
        ],
        "1x2": [
          n("text", { x: 5, y: 10, w: 40, h: 12, text: "AIR QUALITY" }),
          n("metric", { x: 5, y: 32, w: 36, h: 36, text: "28" }),
          n("text", {
            x: 5,
            y: 72,
            w: 36,
            h: 14,
            text: "AQI · Good",
            fontSize: 13,
            color: "#3dd68c",
          }),
          n("gauge", { x: 58, y: 18, w: 34, h: 64, value: 76, text: "76" }),
        ],
        "2x2": [
          n("text", { x: 6, y: 6, w: 50, h: 7, text: "AIR QUALITY" }),
          n("gauge", { x: 28, y: 16, w: 44, h: 44, value: 76, text: "Good" }),
          n("bar", { x: 8, y: 66, w: 84, h: 4, value: 76, accent: "#3dd68c" }),
          n("text", {
            x: 8,
            y: 74,
            w: 84,
            h: 8,
            text: "Filter 76% · Auto mode",
            fontSize: 13,
            color: "#8b909d",
          }),
        ],
      }),
  },
  {
    id: "controls",
    label: "Controls",
    hint: "Chip grid",
    make: () =>
      def("Controls", ["1x1", "1x2", "2x2"], {
        "1x1": [
          n("text", { x: 8, y: 7, w: 70, h: 10, text: "SCENES" }),
          n("chip", { x: 8, y: 28, w: 40, h: 16, text: "Night" }),
          n("chip", { x: 52, y: 28, w: 40, h: 16, text: "Movie" }),
          n("chip", { x: 8, y: 52, w: 40, h: 16, text: "Away" }),
          n("chip", { x: 52, y: 52, w: 40, h: 16, text: "Focus" }),
        ],
        "1x2": [
          n("text", { x: 4, y: 8, w: 40, h: 12, text: "SCENES" }),
          n("chip", { x: 4, y: 36, w: 22, h: 28, text: "Night" }),
          n("chip", { x: 28, y: 36, w: 22, h: 28, text: "Movie" }),
          n("chip", { x: 52, y: 36, w: 22, h: 28, text: "Away" }),
          n("chip", { x: 76, y: 36, w: 20, h: 28, text: "Focus" }),
        ],
        "2x2": [
          n("text", { x: 6, y: 6, w: 50, h: 7, text: "SCENES" }),
          n("button", { x: 6, y: 18, w: 42, h: 16, text: "Good Night", fill: "#ffffff" }),
          n("button", {
            x: 52,
            y: 18,
            w: 42,
            h: 16,
            text: "Movie",
            fill: "rgba(255,255,255,0.08)",
            color: "#f4f5f7",
          }),
          n("button", {
            x: 6,
            y: 38,
            w: 42,
            h: 16,
            text: "Away",
            fill: "rgba(255,255,255,0.08)",
            color: "#f4f5f7",
          }),
          n("button", {
            x: 52,
            y: 38,
            w: 42,
            h: 16,
            text: "Focus",
            fill: "rgba(255,255,255,0.08)",
            color: "#f4f5f7",
          }),
          n("divider", { x: 6, y: 60, w: 88, h: 0.6 }),
          n("text", {
            x: 6,
            y: 66,
            w: 88,
            h: 8,
            text: "Tap a scene on the home screen later — this is look only.",
            fontSize: 12,
            color: "#5c6170",
            fontWeight: 500,
          }),
        ],
      }),
  },
  {
    id: "chart",
    label: "Chart",
    hint: "Metric + sparkline",
    make: () =>
      def("Chart", ["1x1", "1x2", "2x2"], {
        "1x1": [
          n("text", { x: 8, y: 8, w: 70, h: 10, text: "CPU", descriptor: "system.cpu.label" }),
          n("metric", {
            x: 8,
            y: 22,
            w: 70,
            h: 28,
            text: "42%",
            descriptor: "system.cpu",
            hook: "Current CPU percent.",
          }),
          n("chart", {
            x: 8,
            y: 62,
            w: 84,
            h: 28,
            accent: "#3dd68c",
            descriptor: "system.cpuHistory",
            hook: "CPU history as comma-separated percents.",
          }),
        ],
        "1x2": [
          n("text", { x: 5, y: 10, w: 40, h: 12, text: "CPU", descriptor: "system.cpu.label" }),
          n("metric", {
            x: 5,
            y: 28,
            w: 40,
            h: 28,
            text: "42%",
            descriptor: "system.cpu",
          }),
          n("chart", {
            x: 48,
            y: 16,
            w: 47,
            h: 68,
            accent: "#3dd68c",
            descriptor: "system.cpuHistory",
          }),
        ],
        "2x2": [
          n("text", { x: 6, y: 6, w: 40, h: 8, text: "CPU", descriptor: "system.cpu.label" }),
          n("metric", {
            x: 6,
            y: 16,
            w: 40,
            h: 18,
            text: "42%",
            descriptor: "system.cpu",
          }),
          n("chart", {
            x: 6,
            y: 38,
            w: 88,
            h: 22,
            accent: "#3dd68c",
            descriptor: "system.cpuHistory",
          }),
          n("text", { x: 6, y: 64, w: 40, h: 8, text: "MEMORY", descriptor: "system.memory.label" }),
          n("chart", {
            x: 6,
            y: 74,
            w: 88,
            h: 20,
            accent: "#a78bfa",
            text: "28, 31, 29, 36, 40, 38, 44, 41, 48, 52, 49, 55",
            descriptor: "system.memoryHistory",
          }),
        ],
      }),
  },
  {
    id: "list",
    label: "List",
    hint: "Title + rows",
    make: () =>
      def("List", ["1x1", "1x2", "2x2"], {
        "1x1": [
          n("text", { x: 8, y: 7, w: 80, h: 10, text: "UP NEXT" }),
          n("text", { x: 8, y: 28, w: 84, h: 14, text: "Standup", color: "#f4f5f7", fontSize: 15 }),
          n("text", { x: 8, y: 44, w: 84, h: 10, text: "10:00 · Kitchen", fontSize: 12 }),
          n("text", { x: 8, y: 62, w: 84, h: 14, text: "Lunch walk", color: "#f4f5f7", fontSize: 15 }),
          n("text", { x: 8, y: 78, w: 84, h: 10, text: "12:30", fontSize: 12 }),
        ],
        "1x2": [
          n("text", { x: 4, y: 8, w: 40, h: 12, text: "UP NEXT" }),
          n("box", { x: 4, y: 28, w: 44, h: 56, fill: "rgba(255,255,255,0.04)", radius: 14 }),
          n("text", { x: 7, y: 34, w: 38, h: 14, text: "Standup", color: "#f4f5f7", fontSize: 15 }),
          n("text", { x: 7, y: 50, w: 38, h: 12, text: "10:00", fontSize: 12 }),
          n("box", { x: 52, y: 28, w: 44, h: 56, fill: "rgba(255,255,255,0.04)", radius: 14 }),
          n("text", { x: 55, y: 34, w: 38, h: 14, text: "Lunch walk", color: "#f4f5f7", fontSize: 15 }),
          n("text", { x: 55, y: 50, w: 38, h: 12, text: "12:30", fontSize: 12 }),
        ],
        "2x2": [
          n("text", { x: 6, y: 6, w: 50, h: 7, text: "UP NEXT" }),
          n("text", { x: 6, y: 18, w: 70, h: 8, text: "Standup", color: "#f4f5f7", fontSize: 16 }),
          n("text", { x: 6, y: 26, w: 70, h: 6, text: "10:00 · Kitchen", fontSize: 12 }),
          n("divider", { x: 6, y: 36, w: 88 }),
          n("text", { x: 6, y: 42, w: 70, h: 8, text: "Lunch walk", color: "#f4f5f7", fontSize: 16 }),
          n("text", { x: 6, y: 50, w: 70, h: 6, text: "12:30 · Outside", fontSize: 12 }),
          n("divider", { x: 6, y: 60, w: 88 }),
          n("text", { x: 6, y: 66, w: 70, h: 8, text: "Design review", color: "#f4f5f7", fontSize: 16 }),
          n("text", { x: 6, y: 74, w: 70, h: 6, text: "15:00 · Studio", fontSize: 12 }),
        ],
      }),
  },
];

export function makeBlankWidget(name = "Untitled"): SlopDef {
  const widget = TEMPLATES[0].make();
  widget.name = name;
  return widget;
}

export function makeFromTemplate(id: string): SlopDef {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  const widget = t.make();
  if (id === "blank") widget.name = "Untitled";
  return widget;
}
