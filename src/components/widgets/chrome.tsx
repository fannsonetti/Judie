import { ReactNode } from "react";

export function Ico({
  children,
  size = 16,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconPlay({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5L8 5.5z" />
    </svg>
  );
}

export function IconPause({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
    </svg>
  );
}

export function IconPrev({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h2.2v14H6V5zm3.4 7L19 5.5v13L9.4 12z" />
    </svg>
  );
}

export function IconNext({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M15.8 5H18v14h-2.2V5zM5 18.5V5.5L14.6 12 5 18.5z" />
    </svg>
  );
}

export function IconSpeaker({ size = 14 }: { size?: number }) {
  return (
    <Ico size={size}>
      <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    </Ico>
  );
}

export const EVENT_COLORS = ["#2E7CF6", "#34C759", "#FF9F0A", "#AF52DE", "#FF3B30"];

export function eventColor(key: string) {
  let n = 0;
  for (const c of key) n += c.charCodeAt(0);
  return EVENT_COLORS[n % EVENT_COLORS.length];
}

export function aqTone(quality: string) {
  if (quality === "Poor") return { fg: "#FF9F0A", bg: "rgba(255,159,10,0.16)", label: "Poor" };
  if (quality === "Moderate") return { fg: "#FFD166", bg: "rgba(255,209,102,0.14)", label: "Moderate" };
  return { fg: "#72B043", bg: "rgba(114,176,67,0.16)", label: "Good" };
}

export type MonthCell = {
  date: Date;
  day: number;
  outside: boolean;
};

/** Weeks that touch this month, with adjacent-month days filled in (Apple-style). */
export function monthCells(view: Date): MonthCell[] {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));
  const cells: MonthCell[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    cells.push({
      date,
      day: date.getDate(),
      outside: date.getMonth() !== month,
    });
  }
  return cells;
}

export function MiniMonth({
  view,
  today = new Date(),
  selected,
  onSelect,
}: {
  view: Date;
  today?: Date;
  selected?: Date;
  onSelect?: (day: Date) => void;
}) {
  const cells = monthCells(view);
  const sel = selected ?? today;
  return (
    <div className="wx-month">
      <div className="wx-month-week">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`${d}${i}`}>{d}</span>
        ))}
      </div>
      <div className="wx-month-grid">
        {cells.map((cell, i) => {
          const isToday =
            cell.date.getDate() === today.getDate() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getFullYear() === today.getFullYear();
          const isSelected =
            cell.date.getDate() === sel.getDate() &&
            cell.date.getMonth() === sel.getMonth() &&
            cell.date.getFullYear() === sel.getFullYear();
          return (
            <button
              key={i}
              type="button"
              className={`wx-day-btn ${cell.outside ? "outside" : ""} ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "is-today" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(cell.date);
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Gauge({
  pct,
  color,
  children,
  size = 108,
}: {
  pct: number;
  color: string;
  children?: ReactNode;
  size?: number;
}) {
  const r = 38;
  const c = 2 * Math.PI * r;
  // 270° horseshoe, gap centered on the bottom so the arc is not lopsided.
  const arc = c * 0.75;
  const dash = Math.max(0.08, Math.min(1, pct)) * arc;
  const gap = c - dash;
  return (
    <div className="wx-gauge" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          transform="rotate(135 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(135 50 50)"
        />
      </svg>
      <div className="wx-gauge-inner">{children}</div>
    </div>
  );
}

export function FillBar({
  value,
  color = "var(--accent)",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div className="wx-bar">
      <div className="wx-bar-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function WeatherGlyph({ condition, size = 48 }: { condition: string; size?: number }) {
  const c = condition.toLowerCase();
  const rain = c.includes("rain") || c.includes("drizzle") || c.includes("storm");
  const clear = c.includes("clear") || c.includes("sun");
  return (
    <svg
      className="wx-glyph"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      {clear && !rain ? (
        <>
          <circle cx="32" cy="32" r="12" fill="#FFD56A" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const r = ((deg - 90) * Math.PI) / 180;
            const x1 = 32 + Math.cos(r) * 18;
            const y1 = 32 + Math.sin(r) * 18;
            const x2 = 32 + Math.cos(r) * 24;
            const y2 = 32 + Math.sin(r) * 24;
            return (
              <line
                key={deg}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#FFD56A"
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </>
      ) : (
        <>
          <ellipse cx="28" cy="30" rx="14" ry="10" fill="#D7E3F4" />
          <ellipse cx="40" cy="32" rx="12" ry="9" fill="#C5D4EA" />
          <ellipse cx="34" cy="26" rx="10" ry="8" fill="#E8EEF7" />
          {rain && (
            <>
              <line x1="24" y1="44" x2="20" y2="54" stroke="#8EC8FF" strokeWidth="3" strokeLinecap="round" />
              <line x1="34" y1="46" x2="30" y2="56" stroke="#8EC8FF" strokeWidth="3" strokeLinecap="round" />
              <line x1="44" y1="44" x2="40" y2="54" stroke="#8EC8FF" strokeWidth="3" strokeLinecap="round" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

export function Sparkline({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const w = 160;
  const h = 36;
  const pad = 1.5;
  const pts = values.length < 2 ? [0, 0] : values;
  const last = pts.length - 1;
  const d = pts
    .map((v, i) => {
      const x = last <= 0 ? 0 : (i / last) * w;
      const y = h - pad - (Math.min(100, Math.max(0, v)) / 100) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="tm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="miter"
        strokeLinecap="butt"
        strokeMiterlimit="8"
        vectorEffect="nonScalingStroke"
      />
    </svg>
  );
}
