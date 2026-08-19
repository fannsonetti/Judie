import { useRoomStore } from "../../store/roomStore";
import { comfortLabel } from "../../lib/comfort";
import { Gauge } from "./chrome";

interface Props {
  size: string;
}

export function ClimateWidget({ size }: Props) {
  const climate = useRoomStore((s) => s.climate);
  const medium = size === "1x2";
  const status = comfortLabel(climate.indoorTemp, climate.humidity);

  return (
    <div className="wx climate fill">
      <div className="wx-head">
        <span className="wx-app-name">Indoor</span>
        <span className="wx-muted">{status}</span>
      </div>
      <div className="climate-hero grow">
        <Gauge pct={climate.humidity / 100} color="#5ac8fa" size={medium ? 108 : 86}>
          <strong>{climate.indoorTemp.toFixed(1)}°</strong>
          <span className="wx-muted">Now</span>
        </Gauge>
        <div className="climate-side">
          <div>
            <div className="wx-muted">Humidity</div>
            <strong>{climate.humidity}%</strong>
          </div>
          <div>
            <div className="wx-muted">Outdoor</div>
            <strong>{climate.outdoorTemp}°</strong>
          </div>
          {medium && (
            <div>
              <div className="wx-muted">Comfort</div>
              <strong>{status}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
