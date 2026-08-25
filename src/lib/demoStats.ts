import type { HostStats } from "./hostStats";
import { DEFAULT_EVENTS, DEFAULT_LIGHTS, DEFAULT_QUEUE, DAILY_FORECAST, HOURLY_FORECAST } from "./mockData";
import type { ActivityItem } from "../store/activityStore";
import type { WeatherState } from "../store/roomStore";
import type { TimerSnap } from "../assistant/types";

function series(base: number, amp: number, n = 16, phase = 0): number[] {
  return Array.from({ length: n }, (_, i) => {
    const v =
      base +
      Math.sin(i / 2.4 + phase) * amp +
      Math.sin(i / 6.1 + phase * 0.4) * (amp * 0.35);
    return Math.round(Math.max(0, Math.min(100, v)));
  });
}

export const DEMO_WEATHER: WeatherState = {
  location: "Hafnarfjörður",
  temp: 11,
  condition: "Cloudy",
  high: 13,
  low: 9,
  precipNote: "Rain around 22:00",
  humidity: 78,
  wind: 18,
  feel: "Cool & calm",
  hourly: HOURLY_FORECAST,
  daily: DAILY_FORECAST,
  fetchedAt: 1,
  stale: false,
};

export const DEMO_CLIMATE = {
  indoorTemp: 21.4,
  outdoorTemp: 11,
  humidity: 42,
  comfort: "Comfortable",
};

export const DEMO_PURIFIER = {
  on: true,
  mode: "auto" as const,
  fanSpeed: 42,
  airQuality: "Good" as const,
  aqi: 28,
  filterHealth: 76,
};

export const DEMO_LIGHTS = {
  masterOn: true,
  masterBrightness: 68,
  masterColor: "#FFB366",
  scene: "Cozy" as const,
  lights: DEFAULT_LIGHTS,
};

export const DEMO_MEDIA = {
  playing: true,
  progress: 42,
  volume: 62,
  trackIndex: 1,
  queue: DEFAULT_QUEUE,
};

export const DEMO_SERVER = {
  online: true,
  latency: 6,
  services: [
    { name: "Core", online: true, latency: 4 },
    { name: "Lights", online: true, latency: 6 },
    { name: "Media", online: true, latency: 9 },
    { name: "Weather", online: true, latency: 12 },
  ],
};

export const DEMO_EVENTS = DEFAULT_EVENTS;

export const DEMO_TIMERS: TimerSnap[] = [
  {
    id: "demo-pasta",
    name: "Pasta",
    kind: "timer",
    fireAt: 0,
    createdAt: 0,
    fireText: "8:12",
  },
  {
    id: "demo-tea",
    name: "Tea",
    kind: "timer",
    fireAt: 0,
    createdAt: 0,
    fireText: "2:40",
  },
];

const DEMO_NOW = Date.UTC(2026, 7, 25, 14, 8, 0);

export const DEMO_ACTIVITY: ActivityItem[] = [
  {
    id: "d1",
    ts: DEMO_NOW,
    source: "assistant",
    title: "Dimmed the sofa lights",
    outcome: "ok",
  },
  {
    id: "d2",
    ts: DEMO_NOW - 8 * 60_000,
    source: "routine",
    title: "Good night scene",
    outcome: "ok",
  },
  {
    id: "d3",
    ts: DEMO_NOW - 22 * 60_000,
    source: "user",
    title: "Started Ocean Waves",
    outcome: "ok",
  },
  {
    id: "d4",
    ts: DEMO_NOW - 41 * 60_000,
    source: "timer",
    title: "Pasta timer finished",
    outcome: "ok",
  },
  {
    id: "d5",
    ts: DEMO_NOW - 73 * 60_000,
    source: "automation",
    title: "Purifier set to Auto",
    outcome: "ok",
  },
  {
    id: "d6",
    ts: DEMO_NOW - 98 * 60_000,
    source: "system",
    title: "Weather updated",
    outcome: "ok",
  },
];

export const DEMO_HOST_STATS: HostStats = {
  cpu: 28,
  memory: 54,
  memoryUsedMb: 8840,
  memoryTotalMb: 16384,
  swap: 8,
  swapUsedMb: 410,
  swapTotalMb: 8192,
  cores: [22, 18, 31, 14, 27, 19, 24, 16],
  load1: 1.12,
  load5: 0.94,
  load15: 0.81,
  uptimeSec: 52 * 3600 + 18 * 60,
  processCount: 186,
  temperature: 54,
  cpuHistory: series(28, 10, 16, 0.2),
  memoryHistory: series(54, 6, 16, 1.1),
  swapHistory: series(8, 4, 16, 0.6),
  loadHistory: series(36, 12, 16, 0.9),
  tempHistory: series(54, 5, 16, 1.4),
  top: [
    { name: "Cursor", cpu: 12.4, memoryMb: 1420, memoryPct: 8.6 },
    { name: "chrome", cpu: 8.1, memoryMb: 980, memoryPct: 6.0 },
    { name: "Judie", cpu: 3.2, memoryMb: 410, memoryPct: 2.5 },
    { name: "node", cpu: 2.4, memoryMb: 280, memoryPct: 1.7 },
    { name: "Code", cpu: 1.8, memoryMb: 620, memoryPct: 3.8 },
    { name: "spotify", cpu: 0.9, memoryMb: 190, memoryPct: 1.2 },
  ],
};
