import { useRoomStore } from "../../store/roomStore";

interface Props {
  size: string;
}

export function WeatherWidget({ size }: Props) {
  const weather = useRoomStore((s) => s.weather);
  const large = size === "2x2";
  const small = size === "1x1";

  return (
    <div className="wx weather fill">
      <div className="wx-head">
        <span className="wx-app-name">{weather.location}</span>
        <span className="wx-muted">{weather.feel}</span>
      </div>
      <div>
        <div className="wx-metric">{weather.temp}°</div>
        <div className="wx-condition">{weather.condition}</div>
        <div className="wx-muted">L{weather.low}°  H{weather.high}°</div>
        {!small && <div className="wx-weather-note">{weather.precipNote}</div>}
      </div>
      {!small && (
        <div className="wx-hours">
          {weather.hourly.slice(0, large ? 6 : 5).map((h) => (
            <div key={h.hour} className="wx-hour">
              <span>{h.hour.replace(":00", "")}</span>
              <strong>{h.temp}°</strong>
              <em>{h.precip}%</em>
            </div>
          ))}
        </div>
      )}
      {large && weather.daily.length > 0 && (
        <div className="wx-days">
          {weather.daily.map((d) => (
            <div key={d.label} className="wx-day">
              <span>{d.label}</span>
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
