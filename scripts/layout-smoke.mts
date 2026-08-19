import {
  packWidgets,
  reorderWidgets,
  normalizeOrders,
  cycleSize,
} from "../src/lib/layout.ts";
import type { WidgetInstance } from "../src/types/widgets.ts";

const widgets: WidgetInstance[] = [
  { id: "a", type: "weather", page: 0, size: "2x2", order: 0 },
  { id: "b", type: "lights", page: 0, size: "2x2", order: 1 },
  { id: "c", type: "calendar", page: 0, size: "2x1", order: 2 },
];

const packed = packWidgets(widgets);
console.log(
  "packed:",
  packed.map((w) => `${w.id}@${w.col},${w.row}`)
);

const reordered = normalizeOrders(reorderWidgets(widgets, "c", "a"));
console.log(
  "reorder c before a:",
  reordered
    .filter((w) => w.page === 0)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.id)
);

const packed2 = packWidgets(reordered.filter((w) => w.page === 0));
console.log(
  "packed after reorder:",
  packed2.map((w) => `${w.id}@${w.col},${w.row}`)
);

// Ensure no overlaps
function assertNoOverlap(list: typeof packed2) {
  const cells = new Set<string>();
  for (const w of list) {
    const cols = w.size === "1x1" ? 1 : w.size.startsWith("3") ? 3 : 2;
    const rows = w.size === "2x2" ? 2 : 1;
    for (let r = w.row; r < w.row + rows; r++) {
      for (let c = w.col; c < w.col + cols; c++) {
        const key = `${r}:${c}`;
        if (cells.has(key)) throw new Error(`overlap at ${key}`);
        cells.add(key);
      }
    }
  }
}
assertNoOverlap(packed);
assertNoOverlap(packed2);

console.log("cycle media size:", cycleSize("2x1", ["2x1", "2x2"]));
console.log("OK");
