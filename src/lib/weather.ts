import { InstallationConfig } from "./config";

export interface WeatherSnapshot {
  location: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  precipNote: string;
  humidity: number;
  wind: number;
  feel: string;
  hourly: {
    hour: string;
    temp: number;
    condition: string;
    precip: number;
    wind: number;
  }[];
  daily: {
    date: string;
    label: string;
    high: number;
    low: number;
    condition: string;
    precip: number;
  }[];
  fetchedAt: number;
  stale: boolean;
}

const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorm",
};

function conditionFromCode(code: number) {
  return WMO[code] ?? "Cloudy";
}

function feelFrom(temp: number, humidity: number, wind: number) {
  if (temp <= 2) return "Bitter";
  if (temp < 8 && wind > 20) return "Raw";
  if (temp < 10) return "Cool";
  if (humidity > 80 && temp >= 10) return "Damp";
  if (temp > 22) return "Warm";
  return "Cool & calm";
}

export async function fetchWeather(
  cfg: InstallationConfig,
  signal?: AbortSignal
): Promise<WeatherSnapshot> {
  const tempUnit = cfg.tempUnit === "f" || cfg.units === "imperial" ? "fahrenheit" : "celsius";
  const windUnit = cfg.units === "imperial" ? "mph" : "kmh";
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${cfg.latitude}` +
    `&longitude=${cfg.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature` +
    `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=7&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
  const data = await res.json();

  const now = new Date();
  const hours: string[] = data.hourly?.time ?? [];
  const start = hours.findIndex((t) => new Date(t).getTime() >= now.getTime() - 30 * 60 * 1000);
  const from = start < 0 ? 0 : start;
  const hourly = hours.slice(from, from + 12).map((t: string, i: number) => {
    const idx = from + i;
    const d = new Date(t);
    return {
      hour: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
      temp: Math.round(data.hourly.temperature_2m[idx]),
      condition: conditionFromCode(data.hourly.weather_code[idx]),
      precip: Number(data.hourly.precipitation_probability[idx] ?? 0),
      wind: Math.round(data.hourly.wind_speed_10m[idx] ?? 0),
    };
  });

  const dailyDates: string[] = data.daily?.time ?? [];
  const daily = dailyDates.map((date: string, i: number) => {
    const d = new Date(date + "T12:00:00");
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "long" });
    return {
      date,
      label,
      high: Math.round(data.daily.temperature_2m_max[i]),
      low: Math.round(data.daily.temperature_2m_min[i]),
      condition: conditionFromCode(data.daily.weather_code[i]),
      precip: Number(data.daily.precipitation_probability_max[i] ?? 0),
    };
  });

  const rainHour = hourly.find((h) => h.precip >= 50);
  const precipNote = rainHour
    ? `${rainHour.condition} around ${rainHour.hour}`
    : daily[0]?.precip
      ? `${daily[0].precip}% chance of rain today`
      : "Dry for now";

  const temp = Math.round(data.current.temperature_2m);
  const humidity = Math.round(data.current.relative_humidity_2m);
  const wind = Math.round(data.current.wind_speed_10m);

  return {
    location: cfg.locationName,
    temp,
    condition: conditionFromCode(data.current.weather_code),
    high: daily[0]?.high ?? temp,
    low: daily[0]?.low ?? temp,
    precipNote,
    humidity,
    wind,
    feel: feelFrom(temp, humidity, wind),
    hourly,
    daily,
    fetchedAt: Date.now(),
    stale: false,
  };
}
