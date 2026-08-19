import { useLayoutEffect, useRef, useState } from "react";
import { WidgetInstance } from "../../types/widgets";
import { packWidgets } from "../../lib/layout";
import { WidgetContainer } from "./WidgetContainer";

interface Props {
  widgets: WidgetInstance[];
}

export function WidgetGrid({ widgets }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ cellW: 160, cellH: 160, gap: 16 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const gap = Math.max(12, Math.min(20, rect.width * 0.012));
      const cellW = rect.width / 6;
      const rowsTarget = Math.max(3.2, Math.min(4.2, rect.height / (rect.width / 6)));
      const cellH = rect.height / rowsTarget;
      setMetrics({ cellW, cellH, gap });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const placed = packWidgets(widgets);

  return (
    <div className="widget-grid" ref={ref}>
      {placed.map((w) => (
        <WidgetContainer
          key={w.id}
          widget={w}
          cellW={metrics.cellW}
          cellH={metrics.cellH}
          gap={metrics.gap}
        />
      ))}
    </div>
  );
}
