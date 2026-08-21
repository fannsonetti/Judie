import { useActivityStore } from "../../store/activityStore";
import { formatClock } from "../../lib/time";

interface Props {
  size: string;
}

const SOURCE_LABEL: Record<string, string> = {
  user: "Manual",
  assistant: "Judie",
  routine: "Routine",
  timer: "Timer",
  automation: "Auto",
  system: "System",
};

export function ActivityWidget({ size }: Props) {
  const items = useActivityStore((s) => s.items);
  const large = size === "2x2";
  const small = size === "1x1";
  const shown = items.slice(0, small ? 4 : large ? 8 : 5);

  return (
    <div className="wx activity fill">
      <div className="wx-head">
        <span className="wx-app-name">Activity</span>
        <span className="wx-muted">{items.length}</span>
      </div>
      <div className="act-list grow">
        {shown.length === 0 && (
          <>
            <div className="act-row"><span>Now</span><strong>Waiting for Judie</strong><em>System</em></div>
            <div className="act-row"><span>—</span><strong>Lights and media will land here</strong><em>Hint</em></div>
          </>
        )}
        {shown.map((item) => (
          <div key={item.id} className="act-row">
            <span>{formatClock(new Date(item.ts))}</span>
            <strong>{item.title}</strong>
            {!small && <em>{SOURCE_LABEL[item.source] ?? item.source}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}
