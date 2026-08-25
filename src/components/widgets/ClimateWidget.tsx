import { useRoomStore } from "../../store/roomStore";
import { DEMO_CLIMATE } from "../../lib/demoStats";
import { comfortLabel } from "../../lib/comfort";
import { Gauge } from "./chrome";
import { useWidgetDemo } from "./demo";

interface Props {
  size: string;
}

export function ClimateWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.climate);
  const climate = demo ? DEMO_CLIMATE : live;
  const medium = size === "1x2";
  const status = comfortLabel(climate.indoorTemp, climate.humidity);

  return (
    <div className="wx climate fill">
      <div className="climate-hero grow">
        <Gauge pct={climate.humidity / 100} color="#5ac8fa" size={medium ? 108 : 78}>
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
