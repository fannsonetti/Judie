import { useLayoutEffect, useRef, useState } from "react";
import { WidgetInstance } from "../../types/widgets";
import { placeWidgets } from "../../lib/layout";
import { measureWidgetGrid } from "../../lib/widgetGrid";
import { WidgetContainer } from "./WidgetContainer";

interface Props {
  widgets: WidgetInstance[];
}

export function WidgetGrid({ widgets }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragLayerRef = useRef<HTMLDivElement>(null);
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
    </div>
  );
}
