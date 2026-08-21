import { useEffect, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { formatCountdown } from "../../lib/time";

interface Props {
  size: string;
}

export function TimersWidget({ size }: Props) {
  const timers = useRoomStore((s) => s.timers);
  const completeTimer = useRoomStore((s) => s.completeTimer);
  const [, setTick] = useState(0);
  const medium = size === "1x2";

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ordered = [...timers].sort((a, b) => a.fireAt - b.fireAt);

  return (
    <div className="wx timers fill">
      <div className="wx-head">
        <span className="wx-app-name">Timers</span>
        <span className="wx-pill quiet">{ordered.length}</span>
      </div>
      {!ordered.length && (
        <div className="timer-empty grow">
          <div className="wx-metric sm">0:00</div>
          <div className="wx-muted">No timers running. Ask Judie for five minutes.</div>
        </div>
      )}
      {ordered[0] && (
        <div className="grow">
          <div className="wx-metric">{formatCountdown(ordered[0].fireAt - Date.now())}</div>
          <div className="wx-muted">{ordered[0].name}</div>
        </div>
      )}
      {medium && ordered.slice(1, 3).map((t) => (
        <div key={t.id} className="svc-row">
          <span>{t.name}</span>
          <em>{formatCountdown(t.fireAt - Date.now())}</em>
        </div>
      ))}
      {medium && ordered[0] && (
        <button type="button" className="wx-pill" onClick={(e) => { e.stopPropagation(); completeTimer(ordered[0].id); }}>
          Cancel
        </button>
      )}
    </div>
  );
}
