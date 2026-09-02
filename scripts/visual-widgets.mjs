import { readFileSync } from "node:fs";
import {
  CANONICAL_SIZE,
  PREVIEW_KINDS,
  PREVIEW_STAGE_SCALE,
  diffRenders,
  placedRender,
  previewRender,
  scaledPreviewBox,
  scaledPreviewQuality,
} from "../src/lib/widgetPreview.ts";

/**
 * Linux visual-regression for widget preview vs placed widgets.
 *
 * Pixel framebuffer capture of the Slint software renderer needs the Pi (or
 * xvfb + judie-pi). This harness still runs everywhere and proves:
 *   1. placed and 1:1 preview share WidgetFace + the same frozen fixture
 *   2. scaled editor previews keep aspect ratio, stay pixel-aligned, and clip
 *      to the 240 stage
 *
 * Tolerance: 0. Canonical widths/heights are even, so a 0.5 scale is exact
 * and does not need a fuzzy pixel budget.
 */

const faces = readFileSync(new URL("../src-tauri/ui/pi/faces.slint", import.meta.url), "utf8");
const preview = readFileSync(new URL("../src-tauri/ui/pi/preview.slint", import.meta.url), "utf8");
const slint = readFileSync(new URL("../src-tauri/ui/pi/main.slint", import.meta.url), "utf8");

function fail(msg) {
  throw new Error(msg);
}

if (!preview.includes("WidgetFace") || !preview.includes("preview-scale")) fail("preview.slint is not a presentation layer over WidgetFace");
if (!faces.includes("face-scale")) fail("WidgetFace is missing the shared scale factor");
if (!slint.includes("WidgetPreview")) fail("gallery does not use WidgetPreview");

const kinds = PREVIEW_KINDS;
const sizes = ["1x1", "1x2", "2x2"];
let compared = 0;
for (const kind of kinds) {
  for (const size of sizes) {
    const diffs = diffRenders(placedRender(kind, size), previewRender(kind, size, 1));
    if (diffs.length) fail(`${kind} ${size} 1:1 placed vs preview: ${JSON.stringify(diffs)}`);
    const q = scaledPreviewQuality(size);
    if (!q.aspectOk) fail(`${kind} ${size} aspect changed while scaling`);
    if (!q.noStretch) fail(`${kind} ${size} independent x/y scale`);
    if (!q.pixelAligned) fail(`${kind} ${size} fractional box`);
    if (!q.fitsStage) fail(`${kind} ${size} clipped by the 240 stage`);
    const box = scaledPreviewBox(size);
    const canon = CANONICAL_SIZE[size];
    if (Math.abs(box.w / box.h - canon.w / canon.h) > 0) fail(`${kind} ${size} aspect drifted`);
    compared += 1;
  }
}

if (compared !== kinds.length * sizes.length) fail(`expected ${kinds.length * 3} comparisons, got ${compared}`);
if (PREVIEW_STAGE_SCALE !== 0.5) fail("editor scale must stay 0.5 so Large fills 240");

console.log(`widget visual: ${compared} placed-vs-preview 1:1 matches, scaled previews keep aspect (tolerance 0)`);
console.log("physical Pi still required for framebuffer sharpness of the scaled preview.");
