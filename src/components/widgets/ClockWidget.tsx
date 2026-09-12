import { useEffect, useState } from "react";
import type { WidgetSize } from "../../types/widgets";
import { formatClock, formatDateLong } from "../../lib/time";

export function ClockWidget({ size }: { size: WidgetSize }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className={`wx clock digital-clock fill size-${size}`}>
      <strong>{formatClock(now)}</strong>
      {size === "2x2" ? <span className="clock-date">{formatDateLong(now)}</span> : null}
    </div>
  );
}
