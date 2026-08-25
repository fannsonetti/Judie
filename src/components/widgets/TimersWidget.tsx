import { useEffect, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { DEMO_TIMERS } from "../../lib/demoStats";
import { formatCountdown } from "../../lib/time";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

export function TimersWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.timers);
  const completeTimer = useRoomStore((s) => s.completeTimer);
  const [, setTick] = useState(0);
  const medium = size === "1x2";
  const timers = demo ? DEMO_TIMERS : live;

  useEffect(() => {
    if (demo) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [demo]);

  const ordered = demo ? timers : [...timers].sort((a, b) => a.fireAt - b.fireAt);
  const remaining = (t: (typeof ordered)[number]) =>
    demo && t.fireText ? t.fireText : formatCountdown(t.fireAt - Date.now());

  return (
    <div className="wx timers fill">
      {!ordered.length && (
        <div className="timer-empty grow">
          <div className="wx-metric sm">0:00</div>
          <div className="wx-muted">No timers running. Ask Judie for five minutes.</div>
        </div>
      )}
      {ordered[0] && (
        <div className="grow">
          <div className="wx-metric">{remaining(ordered[0])}</div>
          <div className="wx-muted">{ordered[0].name}</div>
        </div>
      )}
      {medium && ordered.slice(1, 3).map((t) => (
        <div key={t.id} className="svc-row">
          <span>{t.name}</span>
          <em>{remaining(t)}</em>
        </div>
      ))}
      {medium && ordered[0] && !demo && (
        <button type="button" className="wx-link" onClick={(e) => { e.stopPropagation(); completeTimer(ordered[0].id); }}>
          Cancel
        </button>
      )}
    </div>
  );
}
