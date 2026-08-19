import type { MouseEvent } from "react";
import { useMemo, useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { eventColor, MiniMonth } from "./chrome";

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
  const events = useRoomStore((s) => s.events);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const small = size === "1x1";
  const medium = size === "1x2";
  const off = offsetFromToday(selected, today);
  const dayEvents = events
    .filter((e) => (e.dayOffset ?? 0) === off)
    .sort((a, b) => a.time.localeCompare(b.time));
  const next = dayEvents[0];

  const shift = (dir: number, e: MouseEvent) => {
    e.stopPropagation();
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1));
  };

  const month = (
    <MiniMonth
      view={cursor}
      today={today}
      selected={selected}
      onSelect={(d) => {
        setSelected(d);
        setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
      }}
    />
  );

  if (small) {
    return (
      <div className="wx cal fill">
        <div className="wx-row between">
          <button type="button" className="wx-nav" onClick={(e) => shift(-1, e)}>‹</button>
          <div className="wx-accent-title">{cursor.toLocaleDateString("en-GB", { month: "long" })}</div>
          <button type="button" className="wx-nav" onClick={(e) => shift(1, e)}>›</button>
        </div>
        {month}
        {next && (
          <div className="wx-event footer">
            <span className="wx-mark" style={{ background: eventColor(next.id) }} />
            <span className="wx-event-time">{next.time}</span>
            <span className="wx-event-title">{next.title}</span>
          </div>
        )}
      </div>
    );
  }

  if (medium) {
    return (
      <div className="wx cal fill">
        <div className="wx-head">
          <span className="wx-app-name">Calendar</span>
          <span className="wx-spacer" />
          <button type="button" className="wx-nav" onClick={(e) => shift(-1, e)}>‹</button>
          <button type="button" className="wx-nav" onClick={(e) => shift(1, e)}>›</button>
        </div>
        <div className="cal-split fill-row">
          <div className="cal-col">
            <div className="wx-accent-title">{dayLabel(selected, today)}</div>
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
          <div className="cal-month-pane">
            <div className="wx-accent-title caps">{cursor.toLocaleDateString("en-GB", { month: "long" })}</div>
            {month}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wx cal fill">
      <div className="wx-head">
        <span className="wx-app-name">Calendar</span>
        <span className="wx-spacer" />
        <button type="button" className="wx-pill" onClick={(e) => { e.stopPropagation(); setSelected(today); setCursor(today); }}>Today</button>
        <button type="button" className="wx-nav" onClick={(e) => shift(-1, e)}>‹</button>
        <button type="button" className="wx-nav" onClick={(e) => shift(1, e)}>›</button>
      </div>
      <div className="cal-quad">
        <div className="cal-q">
          <div className="cal-dow">{selected.toLocaleDateString("en-GB", { weekday: "short" })}</div>
          <div className="cal-num">{selected.getDate()}</div>
          <div className="wx-muted">{selected.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
        </div>
        <div className="cal-q">
          <div className="wx-accent-title caps">{cursor.toLocaleDateString("en-GB", { month: "long" })}</div>
          {month}
        </div>
        <div className="cal-q span2">
          <div className="wx-kicker">{dayLabel(selected, today)}</div>
          {dayEvents.slice(0, 5).map((ev) => (
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
