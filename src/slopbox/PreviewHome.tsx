import { useLayoutEffect, useRef, useState } from "react";
import { WidgetInstance, WidgetSize, SIZE_DIMS } from "../types/widgets";
import { packWidgets } from "../lib/layout";
import { novaHomeGridMetrics, novaShellSize, liveFrame } from "../lib/widgetGrid";
import { SlopLayer } from "./render";
import { SlopDef } from "./schema";

const FILL: WidgetSize[] = ["1x1", "1x2", "2x2", "1x1", "1x2", "1x1", "2x2", "1x2", "1x1", "1x2", "1x1", "2x2"];

interface Props {
  def: SlopDef;
  size: WidgetSize;
}

function LiveFace({ def, size }: { def: SlopDef; size: WidgetSize }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(() => novaShellSize(size, liveFrame()));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  return (
    <div ref={ref} className="widget-face">
      <SlopLayer def={def} size={size} width={box.w} height={box.h} />
    </div>
  );
}

export function PreviewHome({ def, size }: Props) {
  const metrics = novaHomeGridMetrics(liveFrame());
  const widgets: WidgetInstance[] = [
    { id: "live", type: "custom", page: 0, size, order: 0 },
    ...FILL.map((s, i) => ({
      id: `empty-${i}`,
      type: "custom" as const,
      page: 0,
      size: s,
      order: i + 1,
    })),
  ];
  const placed = packWidgets(widgets).filter((w) => w.row < 4);

  return (
    <div className="widget-grid slop-preview-grid">
      {placed.map((w) => {
        const dims = SIZE_DIMS[w.size];
        const width = dims.cols * metrics.cellW;
        const height = dims.rows * metrics.cellH;
        const live = w.id === "live";
        return (
          <div
            key={w.id}
            className="widget-slot"
            style={{
              position: "absolute",
              left: metrics.offsetX + w.col * metrics.cellW,
              top: metrics.offsetY + w.row * metrics.cellH,
              width,
              height,
              padding: metrics.gap / 2,
            }}
          >
            <div className={`widget-shell ${live ? "" : "slop-ghost-shell"}`}>
              {live ? (
                <LiveFace def={def} size={size} />
              ) : (
                <div className="widget-face slop-ghost-face">
                  <span>{w.size.replace("x", " × ")}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
