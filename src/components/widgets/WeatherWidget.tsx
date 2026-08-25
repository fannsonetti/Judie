import { useRoomStore } from "../../store/roomStore";
import { DEMO_WEATHER } from "../../lib/demoStats";
import { useWidgetDemo } from "./demo";
import { WeatherGlyph } from "./chrome";

interface Props {
  size: string;
}

export function WeatherWidget({ size }: Props) {
  const demo = useWidgetDemo();
  const live = useRoomStore((s) => s.weather);
  const weather = demo ? DEMO_WEATHER : live;
  const large = size === "2x2";
  const small = size === "1x1";
  const hours = weather.hourly.slice(0, large ? 6 : 4);

  return (
    <div className={`wx weather fill ${small ? "compact" : ""}`}>
      <div className="wx-head">
        <span className="wx-app-name">{weather.location}</span>
        {!small && <span className="wx-muted">{weather.feel}</span>}
      </div>
      <div className="wx-hero">
        <div>
          <div className="wx-metric">{weather.temp}°</div>
          <div className="wx-condition">{weather.condition}</div>
          <div className="wx-muted">L{weather.low}° · H{weather.high}°</div>
        </div>
        <WeatherGlyph condition={weather.condition} size={small ? 36 : large ? 52 : 44} />
      </div>
      {large && <div className="wx-weather-note">{weather.precipNote}</div>}
      {!small && (
        <div className="wx-hours">
          {hours.map((h) => (
            <div key={h.hour} className="wx-hour">
              <span>{h.hour.replace(":00", "")}</span>
              <WeatherGlyph condition={h.condition} size={16} />
              <strong>{h.temp}°</strong>
              <em>{h.precip}%</em>
            </div>
          ))}
        </div>
      )}
      {large && weather.daily.length > 0 && (
        <div className="wx-days">
          {weather.daily.slice(0, 4).map((d) => (
            <div key={d.label} className="wx-day">
              <span>{d.label}</span>
              <WeatherGlyph condition={d.condition} size={14} />
              <em>{d.precip}%</em>
              <strong>{d.high}°</strong>
              <span className="wx-muted">{d.low}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
