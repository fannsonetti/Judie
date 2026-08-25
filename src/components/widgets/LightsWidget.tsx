import type { PointerEvent } from "react";
import { useRoomStore } from "../../store/roomStore";
import { SWATCHES } from "../../lib/colors";
import { DEMO_LIGHTS } from "../../lib/demoStats";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

export function LightsWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const liveMasterOn = useRoomStore((s) => s.masterOn);
  const liveBrightness = useRoomStore((s) => s.masterBrightness);
  const liveColor = useRoomStore((s) => s.masterColor);
  const liveScene = useRoomStore((s) => s.scene);
  const liveLights = useRoomStore((s) => s.lights);
  const setMasterPower = useRoomStore((s) => s.setMasterPower);
  const setMasterBrightness = useRoomStore((s) => s.setMasterBrightness);
  const setMasterColor = useRoomStore((s) => s.setMasterColor);
  const toggleLight = useRoomStore((s) => s.toggleLight);

  const masterOn = demo ? DEMO_LIGHTS.masterOn : liveMasterOn;
  const masterBrightness = demo ? DEMO_LIGHTS.masterBrightness : liveBrightness;
  const masterColor = demo ? DEMO_LIGHTS.masterColor : liveColor;
  const scene = demo ? DEMO_LIGHTS.scene : liveScene;
  const lights = demo ? DEMO_LIGHTS.lights : liveLights;
  const small = size === "1x1";
  const large = size === "2x2";
  const stop = (e: PointerEvent) => e.stopPropagation();
  const pct = masterOn ? masterBrightness : 0;

  return (
    <div className="wx lights fill" onPointerDown={stop}>
      <div className="wx-head">
        <span className="wx-muted">{scene}</span>
        <span className="wx-spacer" />
        <button
          type="button"
          className={`toggle ${masterOn ? "on" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (!demo) setMasterPower(!masterOn);
          }}
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
        value={pct}
        onChange={(e) => {
          if (!demo) setMasterBrightness(Number(e.target.value));
        }}
        style={{
          ["--pct" as string]: `${pct}%`,
          ["--accent" as string]: masterColor,
        }}
      />
      <div className="swatch-row">
        {(small ? SWATCHES.slice(0, 5) : SWATCHES).map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch ${masterColor.toLowerCase() === c.toLowerCase() ? "on" : ""}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!demo) setMasterColor(c);
            }}
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
              onClick={(e) => {
                e.stopPropagation();
                if (!demo) toggleLight(l.id);
              }}
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
