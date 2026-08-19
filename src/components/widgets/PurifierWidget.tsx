import type { PointerEvent } from "react";
import { useRoomStore } from "../../store/roomStore";
import { aqTone, FillBar, Gauge } from "./chrome";

interface Props {
  size: string;
}

export function PurifierWidget({ size }: Props) {
  const purifier = useRoomStore((s) => s.purifier);
  const setPurifierMode = useRoomStore((s) => s.setPurifierMode);
  const setFanSpeed = useRoomStore((s) => s.setFanSpeed);
  const small = size === "1x1";
  const large = size === "2x2";
  const tone = aqTone(purifier.airQuality);
  const pm = 7;
  const allergens = "4/12";
  const stop = (e: PointerEvent) => e.stopPropagation();

  if (small) {
    return (
      <div className="wx aq fill" onPointerDown={stop}>
        <div className="wx-head">
          <span className="wx-app-name">Air Purifier</span>
        </div>
        <div className="aq-status">Air Quality {tone.label}</div>
        <div className="aq-list grow">
          <div className="aq-row"><span>PM2.5</span><strong>{pm} μg/m³</strong></div>
          <div className="aq-row"><span>Allergens</span><strong>{allergens}</strong></div>
          <div className="aq-row"><span>Filter</span><strong>{purifier.filterHealth}%</strong></div>
        </div>
        <FillBar value={purifier.filterHealth} color={tone.fg} />
      </div>
    );
  }

  return (
    <div className="wx aq fill" onPointerDown={stop}>
      <div className="wx-head">
        <span className="wx-app-name">Air Purifier</span>
        <span className="wx-muted">{purifier.on ? "On" : "Off"}</span>
      </div>
      <div className={`aq-mid ${large ? "large grow" : "grow"}`}>
          <Gauge pct={0.82} color={tone.fg} size={large ? 128 : 112}>
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
            <div className="wx-muted">Filter Cleaning</div>
            <strong>Needs cleaning soon</strong>
            {large && <div className="wx-event-meta">Dust and particles may reduce performance. Clean the filter for best air quality.</div>}
          </div>
        </div>
      </div>
      <div className="aq-filter">
        <span className="wx-muted">Filter Lifetime</span>
        <FillBar value={purifier.filterHealth} color={tone.fg} />
        <strong>{purifier.filterHealth}%</strong>
      </div>
      {large && (
        <div className="aq-modes">
          <span className="wx-muted">Mode</span>
          <button type="button" className={`wx-mode ${purifier.mode === "auto" ? "on" : ""}`} onClick={() => setPurifierMode("auto")}>Auto</button>
          <button type="button" className={`wx-mode ${purifier.mode === "sleep" ? "on" : ""}`} onClick={() => setPurifierMode("sleep")}>Sleep</button>
          <button type="button" className={`wx-mode ${purifier.mode === "manual" ? "on" : ""}`} onClick={() => setFanSpeed(90)}>Boost</button>
        </div>
      )}
    </div>
  );
}
