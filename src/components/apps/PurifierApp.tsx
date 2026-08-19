import { useRoomStore } from "../../store/roomStore";
import { aqTone, FillBar, Gauge } from "../widgets/chrome";

export function PurifierApp() {
  const purifier = useRoomStore((s) => s.purifier);
  const togglePurifier = useRoomStore((s) => s.togglePurifier);
  const setPurifierMode = useRoomStore((s) => s.setPurifierMode);
  const setFanSpeed = useRoomStore((s) => s.setFanSpeed);
  const tone = aqTone(purifier.airQuality);

  return (
    <div className="expanded-body">
      <div className="app-hero">
        <div>
          <p className="app-kicker">Air Purifier</p>
          <h1 className="expanded-title">{tone.label}</h1>
          <p className="expanded-sub">AQI {purifier.aqi} · Filter {purifier.filterHealth}%</p>
        </div>
        <button type="button" className={`toggle ${purifier.on ? "on" : ""}`} onClick={togglePurifier} style={{ transform: "scale(1.15)" }}>
          <span className="toggle-knob" />
        </button>
      </div>

      <div className="app-grid two" style={{ marginBottom: 18 }}>
        <div className="app-card" style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <Gauge pct={0.82} color={tone.fg} size={180}>
            <strong style={{ color: tone.fg, fontSize: 22 }}>{tone.label}</strong>
            <span className="app-muted">Air Quality</span>
          </Gauge>
        </div>
        <div className="app-grid" style={{ gap: 10 }}>
          <div className="app-card"><div className="app-muted">PM2.5</div><strong>7 μg/m³</strong><div className="app-muted">Fine particles</div></div>
          <div className="app-card"><div className="app-muted">Allergens</div><strong>4/12</strong><div className="app-muted">Allergen level</div></div>
          <div className="app-card app-warn">
            <div className="app-muted">Filter Cleaning</div>
            <strong>Needs cleaning soon</strong>
            <div className="app-muted">Dust and particles may reduce performance. Clean the filter for best air quality.</div>
          </div>
        </div>
      </div>

      <div className="app-card" style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>
        <span className="app-muted">Filter Lifetime</span>
        <FillBar value={purifier.filterHealth} color={tone.fg} />
        <strong>{purifier.filterHealth}%</strong>
      </div>

      <div className="app-card">
        <div className="app-muted" style={{ marginBottom: 12 }}>Mode</div>
        <div className="app-modes">
          <button type="button" className={`wx-mode ${purifier.mode === "auto" ? "on" : ""}`} onClick={() => setPurifierMode("auto")}>Auto</button>
          <button type="button" className={`wx-mode ${purifier.mode === "sleep" ? "on" : ""}`} onClick={() => setPurifierMode("sleep")}>Sleep</button>
          <button type="button" className={`wx-mode ${purifier.mode === "manual" ? "on" : ""}`} onClick={() => setFanSpeed(90)}>Boost</button>
        </div>
        <div className="app-muted" style={{ margin: "18px 0 8px" }}>Fan speed · {purifier.fanSpeed}%</div>
        <input className="wx-slider" type="range" min={10} max={100} value={purifier.fanSpeed} onChange={(e) => setFanSpeed(Number(e.target.value))} style={{ ["--pct" as string]: `${purifier.fanSpeed}%` }} />
      </div>
    </div>
  );
}
