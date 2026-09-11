import { useRoomStore } from "../../store/roomStore";
import { DEMO_CLIMATE } from "../../lib/demoStats";
import { comfortLabel } from "../../lib/comfort";

export function ClimateApp() {
  const live = useRoomStore((s) => s.climate);
  const climate = live ?? DEMO_CLIMATE;
  const status = comfortLabel(climate.indoorTemp, climate.humidity);
  return (
    <div className="expanded-body">
      <p className="app-kicker">Climate</p>
      <h1 className="expanded-title">{climate.indoorTemp.toFixed(1)}°</h1>
      <p className="expanded-sub">Indoor now</p>
      <div className="app-grid stats">
        <div className="app-card">
          <div className="app-muted">Humidity</div>
          <strong>{climate.humidity}%</strong>
        </div>
        <div className="app-card">
          <div className="app-muted">Outdoor</div>
          <strong>{climate.outdoorTemp}°</strong>
        </div>
        <div className="app-card">
          <div className="app-muted">Comfort</div>
          <strong>{status}</strong>
        </div>
      </div>
    </div>
  );
}
