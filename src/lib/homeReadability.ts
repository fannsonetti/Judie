/** Home-screen type scale and header geometry for the 1920×1200 kiosk. */

export const HOME_CLOCK_PX = 44;
export const PREVIOUS_CLOCK_PX = 22;
export const HOME_HEADER_H = 88;
export const HOME_FRAME = { w: 1920, h: 1200 };

export const TYPE = {
  clock: HOME_CLOCK_PX,
  hero: 32,
  value: 28,
  title: 16,
  control: 16,
  secondary: 14,
  status: 14,
  dense: 12,
} as const;

/** Approximate advance for DejaVu Sans Mono / ui-monospace at 1em. */
const MONO_ADVANCE = 0.62;

export function textWidth(text: string, fontPx: number) {
  return text.length * fontPx * MONO_ADVANCE;
}

export function textHeight(fontPx: number) {
  return fontPx * 1.15;
}

export function headerColumns(frameW = HOME_FRAME.w) {
  const col = frameW / 3;
  return {
    left: { x: 0, w: col },
    center: { x: col, w: col },
    settings: { x: col * 2, w: col },
  };
}

export function headerLayout(frameW = HOME_FRAME.w, frameH = HOME_FRAME.h) {
  const cols = headerColumns(frameW);
  return {
    ...cols,
    headerH: HOME_HEADER_H,
    widgetsY: HOME_HEADER_H,
    widgetsH: frameH - HOME_HEADER_H,
    edge: 0,
  };
}

export function centerContentFits(text: string, fontPx: number, frameW = HOME_FRAME.w, pad = 16) {
  return textWidth(text, fontPx) <= frameW / 3 - pad;
}

export function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function homeHeaderBoxes(
  clock: string,
  date: string,
  frameW = HOME_FRAME.w
) {
  const cols = headerColumns(frameW);
  const clockW = Math.min(textWidth(clock, TYPE.clock), cols.center.w - 16);
  const dateW = Math.min(textWidth(date, TYPE.status), cols.center.w - 16);
  const clockH = textHeight(TYPE.clock);
  const dateH = textHeight(TYPE.status);
  const stackH = clockH + 2 + dateH;
  const top = (HOME_HEADER_H - stackH) / 2;
  const clockBox = {
    x: cols.center.x + (cols.center.w - clockW) / 2,
    y: top,
    w: clockW,
    h: clockH,
  };
  const dateBox = {
    x: cols.center.x + (cols.center.w - dateW) / 2,
    y: top + clockH + 2,
    w: dateW,
    h: dateH,
  };
  const statusBox = { x: 20, y: 0, w: 160, h: HOME_HEADER_H };
  const settingsBox = { x: cols.settings.x, y: 0, w: cols.settings.w, h: HOME_HEADER_H };
  const widgetsBox = { x: 0, y: HOME_HEADER_H, w: frameW, h: HOME_FRAME.h - HOME_HEADER_H };
  return { clockBox, dateBox, statusBox, settingsBox, widgetsBox, cols };
}

export function assertReadableHierarchy() {
  return (
    TYPE.clock === PREVIOUS_CLOCK_PX * 2 &&
    TYPE.clock > TYPE.hero &&
    TYPE.hero > TYPE.value &&
    TYPE.value > TYPE.title &&
    TYPE.title === TYPE.control &&
    TYPE.secondary === TYPE.status &&
    TYPE.status > TYPE.dense
  );
}
