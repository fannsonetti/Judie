import type { PointerEvent } from "react";
import { useRoomStore } from "../../store/roomStore";
import { DEMO_PURIFIER } from "../../lib/demoStats";
import { aqTone, FillBar, Gauge } from "./chrome";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

export function PurifierWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.purifier);
  const setPurifierMode = useRoomStore((s) => s.setPurifierMode);
  const setFanSpeed = useRoomStore((s) => s.setFanSpeed);
  const purifier = demo ? DEMO_PURIFIER : live;
  const small = size === "1x1";
  const large = size === "2x2";
  const tone = aqTone(purifier.airQuality);
  const pm = 7;
  const allergens = "4/12";
  const stop = (e: PointerEvent) => e.stopPropagation();

  if (small) {
    return (
      <div className="wx aq fill" onPointerDown={stop}>
        <div className="aq-hero">
          <div className="wx-metric sm">{pm}</div>
          <div className="wx-muted">PM2.5 · {tone.label}</div>
        </div>
        <div className="aq-list grow">
          <div className="aq-row"><span>Allergens</span><strong>{allergens}</strong></div>
          <div className="aq-row"><span>Filter</span><strong>{purifier.filterHealth}%</strong></div>
        </div>
        <FillBar value={purifier.filterHealth} color={tone.fg} />
      </div>
    );
  }

  return (
    <div className="wx aq fill" onPointerDown={stop}>
      <div className={`aq-mid ${large ? "large grow" : "grow"}`}>
        <Gauge pct={0.82} color={tone.fg} size={large ? 120 : 96}>
          <strong style={{ color: tone.fg }}>{tone.label}</strong>
          <span className="wx-muted">Air Quality</span>
        </Gauge>
        <div className="aq-cards">
          <div className="wx-card">
            <div className="wx-muted">PM2.5</div>
            <strong>{pm} μg/m³</strong>
            {large && <div className="wx-event-meta">Fine particles</div>}
          </div>
          <div className="wx-card">
            <div className="wx-muted">Allergens</div>
            <strong>{allergens}</strong>
            {large && <div className="wx-event-meta">Allergen level</div>}
          </div>
          <div className={`wx-card warn ${large ? "span2" : ""}`}>
            <div className="wx-muted">Filter</div>
            <strong>Clean soon</strong>
            {large && <div className="wx-event-meta">Dust can cut performance. Clean the filter for the best air.</div>}
          </div>
        </div>
      </div>
      <div className="aq-filter">
        <span className="wx-muted">Filter</span>
        <FillBar value={purifier.filterHealth} color={tone.fg} />
        <strong>{purifier.filterHealth}%</strong>
      </div>
      {large && (
        <div className="aq-modes">
          <span className="wx-muted">Mode</span>
          <button type="button" className={`wx-mode ${purifier.mode === "auto" ? "on" : ""}`} onClick={() => !demo && setPurifierMode("auto")}>Auto</button>
          <button type="button" className={`wx-mode ${purifier.mode === "sleep" ? "on" : ""}`} onClick={() => !demo && setPurifierMode("sleep")}>Sleep</button>
          <button type="button" className={`wx-mode ${purifier.mode === "manual" ? "on" : ""}`} onClick={() => !demo && setFanSpeed(90)}>Boost</button>
        </div>
      )}
    </div>
  );
}
