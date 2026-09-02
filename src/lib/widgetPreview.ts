import { WidgetSize, WidgetType, WIDGET_SUPPORTED_SIZES } from "../types/widgets";
import { GALLERY_SIZE_INFO, GALLERY_STAGE } from "./gallerySizes";

/** Canonical on-screen size for each widget format. Aspect is preserved at every scale. */
export const CANONICAL_SIZE: Record<WidgetSize, { w: number; h: number }> = {
  "1x1": { w: 240, h: 240 },
  "1x2": { w: 480, h: 240 },
  "2x2": { w: 480, h: 480 },
};

/** Editor stage scale: Large fills 240×240; Small/Medium share that linear factor. */
export const PREVIEW_STAGE_SCALE = GALLERY_STAGE.w / CANONICAL_SIZE["2x2"].w;

export type WidgetKind = Exclude<WidgetType, never>;

export const PREVIEW_KINDS: WidgetKind[] = Object.keys(WIDGET_SUPPORTED_SIZES) as WidgetKind[];

export type WidgetFixture = {
  kind: WidgetKind;
  weatherLoc: string;
  weatherTemp: string;
  weatherCond: string;
  weatherRange: string;
  weatherFeel: string;
  weatherNote: string;
  hours: { hour: string; temp: string; precip: string }[];
  masterOn: boolean;
  brightness: number;
  scene: string;
  masterColor: string;
  lights: { id: string; name: string; on: boolean; brightness: string }[];
  playing: boolean;
  trackTitle: string;
  trackArtist: string;
  volume: number;
  mediaProgress: number;
  indoor: string;
  outdoor: string;
  humidity: string;
  comfort: string;
  events: { time: string; title: string; detail: string }[];
  monthName: string;
  calCells: { label: string; today: boolean }[];
  purifierOn: boolean;
  purifierMode: string;
  purifierAq: string;
  purifierFilter: number;
  cpu: number;
  memory: number;
  memDetail: string;
  tempText: string;
  services: { name: string; status: string; online: boolean }[];
  activity: { title: string; source: string; time: string }[];
  timers: { label: string; remain: string }[];
  dnd: boolean;
};

/** Frozen sample data. No clock, locale, network, or RNG. Shared by preview and visual tests. */
export function widgetFixture(kind: WidgetKind): WidgetFixture {
  const cal: { label: string; today: boolean }[] = [];
  for (let d = 1; d <= 30; d++) cal.push({ label: String(d), today: d === 10 });
  while (cal.length < 35) cal.push({ label: "", today: false });
  return {
    kind,
    weatherLoc: "Hafnarfjörður",
    weatherTemp: "18°",
    weatherCond: "Cloudy",
    weatherRange: "H 20°  L 12°",
    weatherFeel: "Feels 16°",
    weatherNote: "Light rain later this evening.",
    hours: [
      { hour: "12", temp: "18°", precip: "10%" },
      { hour: "13", temp: "17°", precip: "20%" },
      { hour: "14", temp: "16°", precip: "15%" },
      { hour: "15", temp: "16°", precip: "5%" },
    ],
    masterOn: true,
    brightness: 40,
    scene: "Focus",
    masterColor: "#2D7BFF",
    lights: [
      { id: "a", name: "Ceiling", on: true, brightness: "40%" },
      { id: "b", name: "Desk", on: true, brightness: "70%" },
      { id: "c", name: "Lamp", on: false, brightness: "Off" },
      { id: "d", name: "Strip", on: true, brightness: "25%" },
    ],
    playing: false,
    trackTitle: "Night Drive",
    trackArtist: "Analog Heart",
    volume: 62,
    mediaProgress: 0.42,
    indoor: "21°",
    outdoor: "7°",
    humidity: "44%",
    comfort: "Comfortable",
    events: [
      { time: "09:00", title: "Stand-up", detail: "Kitchen" },
      { time: "14:30", title: "Delivery", detail: "" },
      { time: "19:00", title: "Dinner", detail: "Home" },
    ],
    monthName: "March",
    calCells: cal,
    purifierOn: true,
    purifierMode: "Auto",
    purifierAq: "Good",
    purifierFilter: 38,
    cpu: 24,
    memory: 51,
    memDetail: "4.1 / 8.0 GB",
    tempText: "52°",
    services: [
      { name: "Core", status: "4 ms", online: true },
      { name: "Lights", status: "6 ms", online: true },
      { name: "Media", status: "9 ms", online: true },
      { name: "Weather", status: "12 ms", online: true },
      { name: "Voice", status: "Down", online: false },
    ],
    activity: [
      { title: "Good Night", source: "Routine", time: "22:14" },
      { title: "Lights Off", source: "You", time: "22:15" },
      { title: "Do Not Disturb", source: "Routine", time: "22:15" },
    ],
    timers: [
      { label: "Pasta", remain: "4:20" },
      { label: "Laundry", remain: "32:00" },
    ],
    dnd: false,
  };
}

export type PreviewBox = {
  w: number;
  h: number;
  scale: number;
  aspect: number;
};

/** Pixel-aligned uniform scale of the canonical widget. Origin is top-left. */
export function scaledPreviewBox(size: WidgetSize, scale = PREVIEW_STAGE_SCALE): PreviewBox {
  const { w, h } = CANONICAL_SIZE[size];
  return {
    w: Math.round(w * scale),
    h: Math.round(h * scale),
    scale,
    aspect: w / h,
  };
}

export function placedCanonicalBox(size: WidgetSize): PreviewBox {
  return scaledPreviewBox(size, 1);
}

export type FaceRender = {
  component: "WidgetFace";
  kind: WidgetKind;
  size: WidgetSize;
  scale: number;
  box: PreviewBox;
  data: WidgetFixture;
  sample: boolean;
  interactive: boolean;
};

export function placedRender(kind: WidgetKind, size: WidgetSize): FaceRender {
  return {
    component: "WidgetFace",
    kind,
    size,
    scale: 1,
    box: placedCanonicalBox(size),
    data: widgetFixture(kind),
    sample: true,
    interactive: false,
  };
}

export function previewRender(kind: WidgetKind, size: WidgetSize, scale = 1): FaceRender {
  return {
    component: "WidgetFace",
    kind,
    size,
    scale,
    box: scaledPreviewBox(size, scale),
    data: widgetFixture(kind),
    sample: true,
    interactive: false,
  };
}

export type VisualDiff = { path: string; a: unknown; b: unknown };

/** 1:1 preview vs placed must be identical. Tolerance is zero; sizes are even so ½ scale is pixel-aligned. */
export function diffRenders(a: FaceRender, b: FaceRender): VisualDiff[] {
  const diffs: VisualDiff[] = [];
  const keys: (keyof FaceRender)[] = ["component", "kind", "size", "scale", "sample", "interactive"];
  for (const key of keys) {
    if (a[key] !== b[key]) diffs.push({ path: String(key), a: a[key], b: b[key] });
  }
  if (a.box.w !== b.box.w || a.box.h !== b.box.h || a.box.aspect !== b.box.aspect) {
    diffs.push({ path: "box", a: a.box, b: b.box });
  }
  const da = JSON.stringify(a.data);
  const db = JSON.stringify(b.data);
  if (da !== db) diffs.push({ path: "data", a: a.data, b: b.data });
  return diffs;
}

export function scaledPreviewQuality(size: WidgetSize) {
  const canon = CANONICAL_SIZE[size];
  const box = scaledPreviewBox(size);
  const info = GALLERY_SIZE_INFO[size];
  return {
    aspectOk: Math.abs(box.w / box.h - canon.w / canon.h) < 1e-9,
    noStretch: box.w / canon.w === box.h / canon.h,
    pixelAligned: Number.isInteger(box.w) && Number.isInteger(box.h),
    fitsStage: box.w <= GALLERY_STAGE.w && box.h <= GALLERY_STAGE.h,
    matchesCaption: info.width === canon.w && info.height === canon.h,
    uniformScale: box.scale === PREVIEW_STAGE_SCALE,
  };
}
