import { useActivityStore } from "../../store/activityStore";
import { DEMO_ACTIVITY } from "../../lib/demoStats";
import { formatClock } from "../../lib/time";
import { useWidgetDemo } from "./demo";

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
  const demo = useWidgetDemo();
  const live = useActivityStore((s) => s.items);
  const items = demo ? DEMO_ACTIVITY : live;
  const large = size === "2x2";
  const small = size === "1x1";
  const shown = items.slice(0, small ? 3 : large ? 7 : 5);

  return (
    <div className="wx activity fill">
      <div className="act-list grow">
        {shown.length === 0 && (
          <>
            <div className="act-row"><span>Now</span><strong>Waiting for Judie</strong><em>System</em></div>
            <div className="act-row"><span>—</span><strong>Lights and media will land here</strong><em>Hint</em></div>
          </>
        )}
        {shown.map((item) => (
          <div key={item.id} className="act-row">
            {!small && <span>{formatClock(new Date(item.ts))}</span>}
            <strong>{item.title}</strong>
            {!small && <em>{SOURCE_LABEL[item.source] ?? item.source}</em>}
          </div>
        ))}
      </div>
    </div>
  );
}
