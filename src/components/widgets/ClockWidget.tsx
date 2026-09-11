import { useEffect, useState } from "react";
import type { WidgetSize } from "../../types/widgets";

export function ClockWidget({ size }: { size: WidgetSize }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = (h + m / 60) * 30;
  const minuteDeg = (m + s / 60) * 6;
  return (
    <div className={`wx clock analog fill size-${size}`}>
      <div className="analog-face">
        <span className="analog-hand hour" style={{ transform: `rotate(${hourDeg}deg)` }} />
        <span className="analog-hand minute" style={{ transform: `rotate(${minuteDeg}deg)` }} />
        <span className="analog-hub" />
      </div>
    </div>
  );
}
