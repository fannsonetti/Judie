import { useEffect, useState } from "react";
import type { WidgetSize } from "../../types/widgets";
import { formatClock, formatClockHms } from "../../lib/time";

export function DigitalClockWidget({ size }: { size: WidgetSize }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const text = size === "1x2" ? formatClockHms(now) : formatClock(now);
  return (
    <div className={`wx digital-clock fill size-${size}`}>
      <strong>{text}</strong>
    </div>
  );
}
