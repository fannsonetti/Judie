import { useId } from "react";
import { formatGb, useHostStats } from "../../lib/hostStats";

interface Props {
  size: string;
}

const CPU = "#3dd68c";
const MEM = "#a78bfa";

export function SystemWidget({ size }: Props) {
  const { stats, available } = useHostStats();
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
  const memDetail = `${formatGb(stats.memoryUsedMb)} / ${formatGb(stats.memoryTotalMb)}`;
  const glow = true;

  const cpuBlock = (
    <MetricBlock label="CPU" value={cpu} values={stats.cpuHistory} color={CPU} glow={glow} />
  );
  const memBlock = (
    <MetricBlock
      label="Memory"
      value={mem}
      values={stats.memoryHistory}
      color={MEM}
      glow={glow}
      detail={wide || large ? memDetail : undefined}
    />
  );

  const processes = stats.top.slice(0, large ? 6 : 5);

  if (!wide && !large) {
    return (
      <div className="wx system fill tm-1x1">
        {cpuBlock}
        <div className="tm-split" />
        {memBlock}
      </div>
    );
  }

  return (
    <div className={`wx system fill ${large ? "tm-2x2" : "tm-1x2"}`}>
      <div className="tm-metrics">
        {cpuBlock}
        <div className="tm-split" />
        {memBlock}
      </div>
      <div className="tm-side">
        <div className="tm-side-label">Top</div>
        {large && (
          <div className="tm-row head">
            <span>Process</span>
            <span>CPU</span>
            <span>Mem</span>
          </div>
        )}
        {processes.map((p) =>
          large ? (
            <div key={p.name} className="tm-row">
              <span className="tm-proc-name">{p.name}</span>
              <span>{p.cpu.toFixed(1)}%</span>
              <span>{p.memoryPct >= 1 ? `${p.memoryPct.toFixed(1)}%` : `${Math.round(p.memoryMb)}M`}</span>
            </div>
          ) : (
            <div key={p.name} className="tm-proc">
              <span className="tm-proc-name">{p.name}</span>
              <em>{Math.round(p.cpu)}%</em>
            </div>
          )
        )}
        {processes.length === 0 && <div className="wx-muted">No processes yet</div>}
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  values,
  color,
  glow,
  detail,
}: {
  label: string;
  value: number;
  values: number[];
  color: string;
  glow: boolean;
  detail?: string;
}) {
  return (
    <div className="tm-block">
      <div className="tm-label">{label}</div>
      <div className="tm-value">{value}%</div>
      {detail && <div className="tm-detail">{detail}</div>}
      <Sparkline values={values} color={color} glow={glow} />
    </div>
  );
}

function Sparkline({
  values,
  color,
  glow,
}: {
  values: number[];
  color: string;
  glow: boolean;
}) {
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
        style={glow ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
      />
    </svg>
  );
}
