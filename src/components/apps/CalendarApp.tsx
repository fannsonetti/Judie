import { useState } from "react";
import { useRoomStore } from "../../store/roomStore";
import { formatClock } from "../../lib/time";
import { eventColor, MiniMonth } from "../widgets/chrome";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function offsetFromToday(day: Date, today: Date) {
  return Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / 86400000);
}

function dayHeading(day: Date, today: Date) {
  const off = offsetFromToday(day, today);
  if (off === 0) return "Today";
  if (off === 1) return "Tomorrow";
  return day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export function CalendarApp() {
  const events = useRoomStore((s) => s.events);
  const addEvent = useRoomStore((s) => s.addEvent);
  const removeEvent = useRoomStore((s) => s.removeEvent);
  const now = formatClock(new Date());
  const today = new Date();
  const [cursor, setCursor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("18:00");
  const off = offsetFromToday(selected, today);
  const dayEvents = [...events]
    .filter((ev) => (ev.dayOffset ?? 0) === off)
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="expanded-body">
      <div className="app-cal">
        <div className="app-cal-month">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <button type="button" className="wx-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
            <div className="wx-accent-title">{cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</div>
            <button type="button" className="wx-nav" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
          </div>
          <MiniMonth
            view={cursor}
            today={today}
            selected={selected}
            onSelect={(d) => {
              setSelected(d);
              setCursor(d);
            }}
          />
        </div>
        <div>
          <p className="app-kicker">{dayHeading(selected, today)}</p>
          <h1 className="expanded-title">{selected.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</h1>
          {dayEvents.map((ev) => (
            <div key={ev.id} className={`app-event ${off === 0 && ev.time < now ? "past" : ""}`}>
              <div className="app-event-time">{ev.time}</div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <span className="wx-mark" style={{ background: eventColor(ev.id), marginTop: 0 }} />
                  {ev.title}
                </div>
                {ev.detail && <div className="app-muted">{ev.detail}</div>}
              </div>
              <button type="button" className="chip" onClick={() => removeEvent(ev.id)}>Remove</button>
            </div>
          ))}
          {dayEvents.length === 0 && <div className="app-muted">Nothing on this day.</div>}
          <div className="app-add">
            <input className="settings-field-input" style={{ width: 110 }} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <input className="settings-field-input" style={{ flex: 1, minWidth: 160 }} placeholder="New event" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button
              type="button"
              className="chip active"
              onClick={() => {
                if (!title.trim()) return;
                addEvent({
                  id: `e-${Date.now().toString(36)}`,
                  time,
                  title: title.trim(),
                  dayOffset: off === 0 ? undefined : off,
                });
                setTitle("");
              }}
            >
              Add Event
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
