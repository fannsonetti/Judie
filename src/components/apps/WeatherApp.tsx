import { useRoomStore } from "../../store/roomStore";
import { useSettingsStore } from "../../store/settingsStore";

export function WeatherApp() {
  const weather = useRoomStore((s) => s.weather);
  const units = useSettingsStore((s) => s.units);
  const windUnit = units === "imperial" ? "mph" : "km/h";
  const temps = weather.hourly.map((h) => h.temp);
  const min = temps.length ? Math.min(...temps) : 0;
  const max = temps.length ? Math.max(...temps) : 1;
  const range = Math.max(1, max - min);
  const pts = weather.hourly.map((h, i) => {
    const x = weather.hourly.length > 1 ? (i / (weather.hourly.length - 1)) * 100 : 0;
    const y = 100 - ((h.temp - min) / range) * 72 - 14;
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <div className="expanded-body">
      <div className="app-hero">
        <div>
          <p className="app-kicker">{weather.location}</p>
          <h1 className="expanded-title">{weather.temp}°</h1>
          <p className="expanded-sub">
            {weather.condition} · L{weather.low}°  H{weather.high}°
          </p>
        </div>
      </div>

      <div className="app-grid stats" style={{ marginBottom: 22 }}>
        <div className="app-card"><div className="app-muted">Wind</div><strong>{weather.wind} {windUnit}</strong></div>
        <div className="app-card"><div className="app-muted">Humidity</div><strong>{weather.humidity}%</strong></div>
        <div className="app-card"><div className="app-muted">Feel</div><strong>{weather.feel || "—"}</strong></div>
        <div className="app-card"><div className="app-muted">Precip</div><strong>{weather.precipNote}</strong></div>
      </div>

      <div className="app-card" style={{ marginBottom: 22 }}>
        <div className="app-muted" style={{ marginBottom: 10 }}>Temperature</div>
        <svg className="app-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon fill="rgba(45,123,255,0.18)" points={area} />
          <polyline fill="none" stroke="var(--accent)" strokeWidth="2.2" points={line} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="app-muted" style={{ marginBottom: 10 }}>Hourly</div>
      <div className="app-hours" style={{ marginBottom: 22 }}>
        {weather.hourly.map((h) => (
          <div key={h.hour} className="app-hour">
            <div className="app-muted">{h.hour}</div>
            <strong>{h.temp}°</strong>
            <div className="app-muted">{h.precip}%</div>
          </div>
        ))}
      </div>

      {weather.daily.length > 0 && (
        <>
          <div className="app-muted" style={{ marginBottom: 8 }}>This week</div>
          <div className="app-days">
            {weather.daily.map((d) => (
              <div key={d.label} className="app-day">
                <span>{d.label}</span>
                <div className="app-day-bar"><span style={{ width: `${Math.min(100, d.precip)}%` }} /></div>
                <strong>{d.high}°</strong>
                <span className="app-muted">{d.low}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
