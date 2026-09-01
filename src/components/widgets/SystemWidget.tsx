import { formatGb, useHostStats } from "../../lib/hostStats";
import { Sparkline } from "./chrome";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

const CPU = "#ffffff";
const MEM = "#c8c8c8";

export function SystemWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const { stats, available } = useHostStats(demo);
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

  const cpuBlock = (
    <MetricBlock
      label="CPU"
      value={cpu}
      values={stats.cpuHistory}
      color={CPU}
    />
  );
  const memBlock = (
    <MetricBlock
      label="Memory"
      value={mem}
      values={stats.memoryHistory}
      color={MEM}
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
              <span>
                {p.memoryPct >= 1 ? `${p.memoryPct.toFixed(1)}%` : `${Math.round(p.memoryMb)}M`}
              </span>
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
  detail,
}: {
  label: string;
  value: number;
  values: number[];
  color: string;
  detail?: string;
}) {
  return (
    <div className="tm-block">
      <div className="tm-label">{label}</div>
      <div className="tm-value">{value}%</div>
      {detail && <div className="tm-detail">{detail}</div>}
      <Sparkline values={values} color={color} />
    </div>
  );
}
