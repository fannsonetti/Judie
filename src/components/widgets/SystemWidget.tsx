import { useId } from "react";
import { formatGb, formatUptime, useHostStats } from "../../lib/hostStats";

interface Props {
  size: string;
}

const CPU = "#3dd68c";
const MEM = "#a78bfa";

export function SystemWidget({ size }: Props) {
  const { stats, available } = useHostStats(2000);
  const wide = size === "1x2";
  const large = size === "2x2";

  if (!available && stats.cpuHistory.length === 0) {
    return (
      <div className="wx system fill">
        <div className="tm-wait">Waiting for system data</div>
      </div>
    );
  }

  const cpu = Math.round(stats.cpu);
  const mem = Math.round(stats.memory);

  if (!wide && !large) {
    return (
      <div className="wx system fill tm-1x1">
        <MetricBlock label="CPU" value={cpu} values={stats.cpuHistory} color={CPU} />
        <div className="tm-split" />
        <MetricBlock label="Memory" value={mem} values={stats.memoryHistory} color={MEM} />
      </div>
    );
  }

  if (wide) {
    return (
      <div className="wx system fill tm-1x2">
        <div className="tm-metrics">
          <MetricBlock label="CPU" value={cpu} values={stats.cpuHistory} color={CPU} />
          <div className="tm-split" />
          <MetricBlock label="Memory" value={mem} values={stats.memoryHistory} color={MEM} />
        </div>
        <div className="tm-side">
          <div className="tm-side-label">Top</div>
          {stats.top.slice(0, 5).map((p) => (
            <div key={p.name} className="tm-proc">
              <span className="tm-proc-name">{p.name}</span>
              <em>{Math.round(p.cpu)}%</em>
            </div>
          ))}
          {stats.top.length === 0 && <div className="wx-muted">No processes yet</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="wx system fill tm-2x2">
      <div className="tm-hero">
        <MetricBlock label="CPU" value={cpu} values={stats.cpuHistory} color={CPU} />
        <MetricBlock label="Memory" value={mem} values={stats.memoryHistory} color={MEM} />
      </div>
      <div className="tm-facts">
        <Fact label="RAM" value={`${formatGb(stats.memoryUsedMb)} / ${formatGb(stats.memoryTotalMb)}`} />
        <Fact
          label="Swap"
          value={
            stats.swapTotalMb > 1
              ? `${Math.round(stats.swap)}% · ${formatGb(stats.swapUsedMb)}`
              : "Off"
          }
        />
        <Fact
          label="Load"
          value={`${stats.load1.toFixed(2)}  ${stats.load5.toFixed(2)}  ${stats.load15.toFixed(2)}`}
        />
        <Fact
          label="Temp"
          value={stats.temperature != null ? `${Math.round(stats.temperature)}°` : "—"}
        />
        <Fact label="Up" value={formatUptime(stats.uptimeSec)} />
        <Fact label="Procs" value={String(stats.processCount)} />
      </div>
      {stats.cores.length > 0 && (
        <div className="tm-cores" aria-label="Per-core CPU">
          {stats.cores.map((c, i) => (
            <div key={i} className="tm-core">
              <div className="tm-core-fill" style={{ height: `${Math.round(c)}%` }} />
            </div>
          ))}
        </div>
      )}
      <div className="tm-table">
        <div className="tm-row head">
          <span>Process</span>
          <span>CPU</span>
          <span>Mem</span>
        </div>
        {stats.top.slice(0, 6).map((p) => (
          <div key={p.name} className="tm-row">
            <span className="tm-proc-name">{p.name}</span>
            <span>{p.cpu.toFixed(1)}%</span>
            <span>{p.memoryPct >= 1 ? `${p.memoryPct.toFixed(1)}%` : `${Math.round(p.memoryMb)}M`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  values,
  color,
}: {
  label: string;
  value: number;
  values: number[];
  color: string;
}) {
  return (
    <div className="tm-block">
      <div className="tm-label">{label}</div>
      <div className="tm-value">{value}%</div>
      <Sparkline values={values} color={color} />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="tm-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 160;
  const h = 36;
  const uid = useId().replace(/:/g, "");
  const pts = values.length < 2 ? [0, 0] : values;
  const last = pts.length - 1;
  const d = pts
    .map((v, i) => {
      const x = last <= 0 ? 0 : (i / last) * w;
      const y = h - (Math.min(100, Math.max(0, v)) / 100) * (h - 2) - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;

  return (
    <svg className="tm-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`tm-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#tm-fill-${uid})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
}
