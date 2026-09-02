import { WidgetSize } from "../types/widgets";

/** Editor size order: Small, Medium, Large. */
export const GALLERY_SIZE_ORDER: WidgetSize[] = ["1x1", "1x2", "2x2"];

export const GALLERY_SIZE_INFO: Record<
  WidgetSize,
  { name: string; width: number; height: number }
> = {
  "1x1": { name: "Small", width: 240, height: 240 },
  "1x2": { name: "Medium", width: 480, height: 240 },
  "2x2": { name: "Large", width: 480, height: 480 },
};

/** Compact carousel stage. Large fills this box; other sizes share its scale. */
export const GALLERY_STAGE = { w: 240, h: 240 };

export function galleryPreviewBox(size: WidgetSize, stage = GALLERY_STAGE) {
  const info = GALLERY_SIZE_INFO[size];
  const scale = Math.min(stage.w / 480, stage.h / 480);
  return { w: info.width * scale, h: info.height * scale };
}

export function gallerySizeCaption(size: WidgetSize) {
  const info = GALLERY_SIZE_INFO[size];
  return `${info.name}  ${info.width}×${info.height}`;
}

export function gallerySizeAt(index: number): WidgetSize {
  return GALLERY_SIZE_ORDER[Math.max(0, Math.min(GALLERY_SIZE_ORDER.length - 1, index))];
}

export function galleryIndexForSize(size: WidgetSize) {
  const i = GALLERY_SIZE_ORDER.indexOf(size);
  return i < 0 ? 0 : i;
}

export function gallerySwipeIndex(from: number, dx: number, threshold = 48) {
  if (dx < -threshold) return Math.min(2, from + 1);
  if (dx > threshold) return Math.max(0, from - 1);
  return from;
}
