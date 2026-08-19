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

export function monthCells(view: Date) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
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
        {cells.map((d, i) => {
          if (!d) return <span key={i} className="empty" />;
          const date = new Date(view.getFullYear(), view.getMonth(), d);
          const isToday =
            d === today.getDate() &&
            view.getMonth() === today.getMonth() &&
            view.getFullYear() === today.getFullYear();
          const isSelected =
            d === sel.getDate() &&
            view.getMonth() === sel.getMonth() &&
            view.getFullYear() === sel.getFullYear();
          return (
            <button
              key={i}
              type="button"
              className={`wx-day-btn ${isSelected ? "selected" : ""} ${isToday && !isSelected ? "is-today" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(date);
              }}
            >
              {d}
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
  const dash = Math.max(0.08, Math.min(1, pct)) * c * 0.78;
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
          strokeDasharray={`${c * 0.78} ${c}`}
          transform="rotate(140 50 50)"
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
          transform="rotate(140 50 50)"
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
