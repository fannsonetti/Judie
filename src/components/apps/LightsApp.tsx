import type { ReactNode } from "react";
import { useRoomStore } from "../../store/roomStore";
import { SWATCHES } from "../../lib/colors";
import { LightScene, SCENE_PRESETS } from "../../lib/mockData";

const HUES = SWATCHES;

export function LightsApp() {
  const masterOn = useRoomStore((s) => s.masterOn);
  const masterBrightness = useRoomStore((s) => s.masterBrightness);
  const masterColor = useRoomStore((s) => s.masterColor);
  const masterColorTemp = useRoomStore((s) => s.masterColorTemp);
  const masterSaturation = useRoomStore((s) => s.masterSaturation);
  const scene = useRoomStore((s) => s.scene);
  const lights = useRoomStore((s) => s.lights);
  const setMasterPower = useRoomStore((s) => s.setMasterPower);
  const setMasterBrightness = useRoomStore((s) => s.setMasterBrightness);
  const setMasterColor = useRoomStore((s) => s.setMasterColor);
  const setMasterColorTemp = useRoomStore((s) => s.setMasterColorTemp);
  const setMasterSaturation = useRoomStore((s) => s.setMasterSaturation);
  const setScene = useRoomStore((s) => s.setScene);
  const updateLight = useRoomStore((s) => s.updateLight);
  const toggleLight = useRoomStore((s) => s.toggleLight);

  return (
    <div className="expanded-body">
      <h1 className="expanded-title">Lights</h1>
      <p className="expanded-sub">Room lighting · {scene}</p>

      <section className="app-grid two">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="light-hero">
            <div>
              <div className="w-label">Master</div>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 4 }}>
                {masterOn ? `${masterBrightness}%` : "Off"}
              </div>
            </div>
            <button
              type="button"
              className={`toggle ${masterOn ? "on" : ""}`}
              onClick={() => setMasterPower(!masterOn)}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <ControlBlock label="Brightness">
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={masterBrightness}
              onChange={(e) => setMasterBrightness(Number(e.target.value))}
            />
          </ControlBlock>

          <ControlBlock label="Color temperature">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              <span>Warm</span>
              <span>{masterColorTemp} K</span>
              <span>Cool</span>
            </div>
            <input
              className="slider warm-cool"
              type="range"
              min={2200}
              max={6500}
              step={50}
              value={masterColorTemp}
              onChange={(e) => setMasterColorTemp(Number(e.target.value))}
            />
          </ControlBlock>

          <ControlBlock label="Saturation">
            <input
              className="slider"
              type="range"
              min={0}
              max={100}
              value={masterSaturation}
              onChange={(e) => setMasterSaturation(Number(e.target.value))}
            />
          </ControlBlock>

          <ControlBlock label="Color">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {HUES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setMasterColor(c)}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: c,
                    border:
                      masterColor.toLowerCase() === c.toLowerCase()
                        ? "2px solid white"
                        : "1px solid rgba(255,255,255,0.15)",
                    boxShadow:
                      masterColor.toLowerCase() === c.toLowerCase()
                        ? `0 0 0 3px var(--accent)`
                        : "none",
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <span
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: masterColor,
                  border: "1px solid var(--border)",
                  marginLeft: 4,
                }}
              />
            </div>
          </ControlBlock>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div className="app-muted" style={{ marginBottom: 8 }}>Scenes</div>
          <div className="app-card" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(Object.keys(SCENE_PRESETS) as LightScene[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`scene-tile ${scene === s ? "on" : ""}`}
                  onClick={() => setScene(s)}
                >
                  <div className="scene-swatch" style={{ background: SCENE_PRESETS[s].color }} />
                  {s}
                </button>
              ))}
          </div>

          <ControlBlock label="Individual lights">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lights.map((l) => (
                <div key={l.id} className="light-row">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: l.on ? l.color : "var(--text-dim)",
                        }}
                      />
                      <span style={{ fontWeight: 550 }}>{l.name}</span>
                    </div>
                    <input
                      className="slider"
                      style={{ marginTop: 10 }}
                      type="range"
                      min={0}
                      max={100}
                      value={l.brightness}
                      onChange={(e) =>
                        updateLight(l.id, {
                          brightness: Number(e.target.value),
                          on: Number(e.target.value) > 0,
                        })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className={`toggle ${l.on ? "on" : ""}`}
                    onClick={() => toggleLight(l.id)}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>
              ))}
            </div>
          </ControlBlock>
        </div>
      </section>
    </div>
  );
}

function ControlBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 20,
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="w-label" style={{ marginBottom: 12 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
