import { useLayoutEffect, useRef, useState } from "react";
import { WidgetSize } from "../../types/widgets";
import { SlopLayer } from "../../slopbox/render";
import { getCustomWidget, useCustomWidgetStore } from "../../store/customWidgetStore";
import { CANONICAL } from "../../slopbox/schema";

interface Props {
  customId?: string;
  size: WidgetSize;
}

export function SlopWidget({ customId, size }: Props) {
  useCustomWidgetStore((s) => s.widgets);
  const def = getCustomWidget(customId);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(CANONICAL[size]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  if (!def) {
    return (
      <div className="slop-missing">
        <strong>Missing widget</strong>
        <span>Open Widget Creator and save this widget to Judie again.</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="slop-host">
      <SlopLayer def={def} size={size} width={box.w} height={box.h} />
    </div>
  );
}
