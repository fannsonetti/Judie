import { WidgetInstance, WidgetSize, SIZE_DIMS } from "../types/widgets";
import { packWidgets } from "../lib/layout";
import { novaHomeGridMetrics } from "../lib/widgetGrid";
import { SlopLayer } from "./render";
import { CANONICAL, SlopDef } from "./schema";

const FILL: WidgetSize[] = ["1x1", "1x2", "2x2", "1x1", "1x2", "1x1", "2x2", "1x2", "1x1", "1x2", "1x1", "2x2"];

interface Props {
  def: SlopDef;
  size: WidgetSize;
}

export function PreviewHome({ def, size }: Props) {
  const metrics = novaHomeGridMetrics();
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
        const inner = CANONICAL[w.size];
        return (
          <div
            key={w.id}
            className="widget-slot"
            style={{
              position: "absolute",
              left: w.col * metrics.cellW,
              top: w.row * metrics.cellH,
              width,
              height,
              padding: metrics.gap / 2,
            }}
          >
            <div className={`widget-shell ${live ? "" : "slop-ghost-shell"}`}>
              {live ? (
                <div className="widget-face">
                  <SlopLayer def={def} size={size} width={inner.w} height={inner.h} />
                </div>
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
