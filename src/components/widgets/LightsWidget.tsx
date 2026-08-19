import type { PointerEvent } from "react";
import { useRoomStore } from "../../store/roomStore";
import { SWATCHES } from "../../lib/colors";

interface Props {
  size: string;
}

export function LightsWidget({ size }: Props) {
  const masterOn = useRoomStore((s) => s.masterOn);
  const masterBrightness = useRoomStore((s) => s.masterBrightness);
  const masterColor = useRoomStore((s) => s.masterColor);
  const scene = useRoomStore((s) => s.scene);
  const lights = useRoomStore((s) => s.lights);
  const setMasterPower = useRoomStore((s) => s.setMasterPower);
  const setMasterBrightness = useRoomStore((s) => s.setMasterBrightness);
  const setMasterColor = useRoomStore((s) => s.setMasterColor);
  const toggleLight = useRoomStore((s) => s.toggleLight);
  const small = size === "1x1";
  const large = size === "2x2";
  const stop = (e: PointerEvent) => e.stopPropagation();

  return (
    <div className="wx lights fill" onPointerDown={stop}>
      <div className="wx-head">
        <span className="wx-app-name">Lights</span>
        <span className="wx-muted">{scene}</span>
        <span className="wx-spacer" />
        <button
          type="button"
          className={`toggle ${masterOn ? "on" : ""}`}
          onClick={(e) => { e.stopPropagation(); setMasterPower(!masterOn); }}
        >
          <span className="toggle-knob" />
        </button>
      </div>
      <div className="wx-metric sm">{masterOn ? `${masterBrightness}%` : "Off"}</div>
      <input
        className="wx-slider"
        type="range"
        min={0}
        max={100}
        value={masterOn ? masterBrightness : 0}
        onChange={(e) => setMasterBrightness(Number(e.target.value))}
        style={{
          ["--pct" as string]: `${masterOn ? masterBrightness : 0}%`,
          ["--accent" as string]: masterColor,
        }}
      />
      <div className="swatch-row">
        {(small ? SWATCHES.slice(0, 6) : SWATCHES).map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${masterColor.toLowerCase() === c.toLowerCase() ? "on" : ""}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={(e) => { e.stopPropagation(); setMasterColor(c); }}
          />
        ))}
      </div>
      {!small && (
        <div className={`lights-grid ${large ? "grow" : ""}`}>
          {(large ? lights : lights.slice(0, 4)).map((l) => (
            <button
              key={l.id}
              type="button"
              className={`light-chip ${l.on ? "on" : ""}`}
              style={l.on ? { borderLeftColor: l.color } : undefined}
              onClick={(e) => { e.stopPropagation(); toggleLight(l.id); }}
            >
              <span>{l.name.replace(" LEDs", "").replace(" Light", "")}</span>
              <em>{l.on ? `${l.brightness}%` : "Off"}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
