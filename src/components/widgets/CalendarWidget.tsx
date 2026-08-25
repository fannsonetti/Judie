import { useMemo, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { DEMO_EVENTS } from "../../lib/demoStats";
import { eventColor, MiniMonth } from "./chrome";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function offsetFromToday(day: Date, today: Date) {
  return Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / 86400000);
}

function dayLabel(day: Date, today: Date) {
  const off = offsetFromToday(day, today);
  if (off === 0) return "Today";
  if (off === 1) return "Tomorrow";
  if (off === -1) return "Yesterday";
  return day.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" });
}

export function CalendarWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.events);
  const events = demo ? DEMO_EVENTS : live;
  const today = useMemo(() => new Date(), []);
  const [selected, setSelected] = useState(today);
  const small = size === "1x1";
  const medium = size === "1x2";
  const off = offsetFromToday(selected, today);
  const dayEvents = events
    .filter((e) => (e.dayOffset ?? 0) === off)
    .sort((a, b) => a.time.localeCompare(b.time));
  const monthName = today.toLocaleDateString("en-GB", { month: "long" });

  const month = (
    <MiniMonth
      view={today}
      today={today}
      selected={selected}
      onSelect={setSelected}
    />
  );

  if (small) {
    return (
      <div className="wx cal fill compact-cal">
        <div className="cal-month-name">{monthName}</div>
        {month}
      </div>
    );
  }

  if (medium) {
    return (
      <div className="wx cal fill compact-cal">
        <div className="cal-split fill-row">
          <div className="cal-col">
            <div className="cal-month-name">{dayLabel(selected, today)}</div>
            {dayEvents.slice(0, 3).map((ev) => (
              <div key={ev.id} className="wx-event stacked">
                <span className="wx-mark" style={{ background: eventColor(ev.id) }} />
                <div>
                  <div className="wx-event-title">{ev.title}</div>
                  <div className="wx-event-meta">{ev.time}{ev.detail ? ` · ${ev.detail}` : ""}</div>
                </div>
              </div>
            ))}
            {dayEvents.length === 0 && <div className="wx-muted">Nothing on this day.</div>}
          </div>
          <div className="cal-month-pane">
            <div className="cal-month-name">{monthName}</div>
            {month}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wx cal fill compact-cal">
      <div className="cal-quad">
        <div className="cal-q">
          <div className="cal-dow">{selected.toLocaleDateString("en-GB", { weekday: "short" })}</div>
          <div className="cal-num">{selected.getDate()}</div>
          <div className="wx-muted">{selected.toLocaleDateString("en-GB", { month: "long" })}</div>
        </div>
        <div className="cal-q">
          <div className="cal-month-name">{monthName}</div>
          {month}
        </div>
        <div className="cal-q span2">
          <div className="wx-kicker">{dayLabel(selected, today)}</div>
          {dayEvents.slice(0, 4).map((ev) => (
            <div key={ev.id} className="wx-event stacked">
              <span className="wx-mark" style={{ background: eventColor(ev.id) }} />
              <div>
                <div className="wx-event-title">{ev.title}</div>
                <div className="wx-event-meta">{ev.time}{ev.detail ? ` · ${ev.detail}` : ""}</div>
              </div>
            </div>
          ))}
          {dayEvents.length === 0 && <div className="wx-muted">Nothing on this day.</div>}
        </div>
      </div>
    </div>
  );
}
