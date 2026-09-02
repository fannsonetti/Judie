import { useLayoutEffect, useRef, useState } from "react";
import { SIZE_DIMS, WIDGET_LABELS, WidgetInstance } from "../../types/widgets";
import { placeWidgets } from "../../lib/layout";
import { REMOVE_BTN_SIZE, removeBtnBox } from "../../lib/widgetDrag";
import { measureWidgetGrid } from "../../lib/widgetGrid";
import { useLayoutStore } from "../../store/layoutStore";
import { WidgetContainer } from "./WidgetContainer";

interface Props {
  widgets: WidgetInstance[];
}

export function WidgetGrid({ widgets }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragLayerRef = useRef<HTMLDivElement>(null);
  const editMode = useLayoutStore((s) => s.editMode);
  const draggingId = useLayoutStore((s) => s.draggingId);
  const requestRemoveWidget = useLayoutStore((s) => s.requestRemoveWidget);
  const [metrics, setMetrics] = useState({
    cellW: 160,
    cellH: 160,
    gap: 16,
    offsetX: 0,
    offsetY: 0,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setMetrics(measureWidgetGrid(rect.width, rect.height));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = placeWidgets(widgets);

  return (
    <div className="widget-grid" ref={ref}>
      {placed.map((w) => (
        <WidgetContainer
          key={w.id}
          widget={w}
          cellW={metrics.cellW}
          cellH={metrics.cellH}
          gap={metrics.gap}
          offsetX={metrics.offsetX}
          offsetY={metrics.offsetY}
          dragLayerRef={dragLayerRef}
        />
      ))}
      <div className="widget-drag-layer" ref={dragLayerRef} />
      <div className="widget-remove-layer">
        {editMode &&
          placed.map((w) => {
            if (draggingId === w.id) return null;
            const dims = SIZE_DIMS[w.size];
            const shellLeft = metrics.offsetX + w.col * metrics.cellW + metrics.gap / 2;
            const shellTop = metrics.offsetY + w.row * metrics.cellH + metrics.gap / 2;
            const shellWidth = dims.cols * metrics.cellW - metrics.gap;
            const box = removeBtnBox(shellLeft, shellTop, shellWidth);
            return (
              <button
                key={w.id}
                type="button"
                className="widget-remove"
                style={{ left: box.x, top: box.y, width: box.size, height: box.size }}
                aria-label={`Remove ${WIDGET_LABELS[w.type]}`}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  requestRemoveWidget(w.id);
                }}
              >
                <svg width={REMOVE_BTN_SIZE} height={REMOVE_BTN_SIZE} viewBox="0 0 40 40" aria-hidden>
                  <path
                    d="M12 12l16 16M28 12L12 28"
                    fill="none"
                    stroke="#000000"
                    strokeWidth="3.5"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
            );
          })}
      </div>
    </div>
  );
}
