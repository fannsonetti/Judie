export interface LightGroup {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
  color: string;
  colorTemp: number; // 2200–6500
  saturation: number; // 0–100
}

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  artworkGradient: string;
  scene: "rain" | "ocean" | "forest" | "cafe" | "fire" | "night";
}

export interface CalendarEvent {
  id: string;
  time: string;
  title: string;
  detail?: string;
  /** 0 = today, 1 = tomorrow, etc. */
  dayOffset?: number;
}

export interface HourlyForecast {
  hour: string;
  temp: number;
  condition: string;
  precip: number;
  wind: number;
}

export interface PurifierState {
  on: boolean;
  mode: "auto" | "manual" | "sleep";
  fanSpeed: number;
  airQuality: "Good" | "Moderate" | "Poor";
  aqi: number;
  filterHealth: number;
}

export type LightScene = "Cozy" | "Movie" | "Night" | "Bright" | "Gaming";

export const SCENE_PRESETS: Record<
  LightScene,
  { brightness: number; color: string; colorTemp: number; saturation: number }
> = {
  Cozy: { brightness: 45, color: "#FFB366", colorTemp: 2700, saturation: 40 },
  Movie: { brightness: 18, color: "#6B8CFF", colorTemp: 4000, saturation: 55 },
  Night: { brightness: 8, color: "#FF8C42", colorTemp: 2200, saturation: 35 },
  Bright: { brightness: 95, color: "#FFF5E6", colorTemp: 5000, saturation: 10 },
  Gaming: { brightness: 60, color: "#2D7BFF", colorTemp: 6500, saturation: 70 },
};

export const DEFAULT_LIGHTS: LightGroup[] = [
  {
    id: "bed",
    name: "Bed LEDs",
    on: true,
    brightness: 72,
    color: "#FFB366",
    colorTemp: 3000,
    saturation: 35,
  },
  {
    id: "sofa",
    name: "Sofa LEDs",
    on: true,
    brightness: 65,
    color: "#FFB366",
    colorTemp: 3000,
    saturation: 35,
  },
  {
    id: "shelf",
    name: "Shelf LEDs",
    on: true,
    brightness: 55,
    color: "#FFC98A",
    colorTemp: 3200,
    saturation: 30,
  },
  {
    id: "ceiling",
    name: "Ceiling Light",
    on: true,
    brightness: 80,
    color: "#FFF0E0",
    colorTemp: 3500,
    saturation: 15,
  },
  {
    id: "desk",
    name: "Desk Light",
    on: false,
    brightness: 70,
    color: "#E8F0FF",
    colorTemp: 4500,
    saturation: 20,
  },
];

export const DEFAULT_QUEUE: MediaTrack[] = [
  {
    id: "rain",
    title: "Rain on Window",
    artist: "Steady rain and distant thunder",
    album: "Ambient",
    duration: 248,
    artworkGradient: "linear-gradient(145deg, #0b1220, #1e293b)",
    scene: "rain",
  },
  {
    id: "ocean",
    title: "Ocean Waves",
    artist: "Soft tide and night air",
    album: "Ambient",
    duration: 212,
    artworkGradient: "linear-gradient(145deg, #071018, #16324a)",
    scene: "ocean",
  },
  {
    id: "forest",
    title: "Forest",
    artist: "Gentle rain and distant birds",
    album: "Ambient",
    duration: 196,
    artworkGradient: "linear-gradient(145deg, #0b1610, #1d3a28)",
    scene: "forest",
  },
  {
    id: "cafe",
    title: "Cafe",
    artist: "Quiet chatter and cups",
    album: "Ambient",
    duration: 231,
    artworkGradient: "linear-gradient(145deg, #1a120c, #3a2718)",
    scene: "cafe",
  },
  {
    id: "fire",
    title: "Fireplace",
    artist: "Low crackle and warmth",
    album: "Ambient",
    duration: 240,
    artworkGradient: "linear-gradient(145deg, #1a0c08, #4a1f12)",
    scene: "fire",
  },
  {
    id: "night",
    title: "Night",
    artist: "Wind and a distant city",
    album: "Ambient",
    duration: 255,
    artworkGradient: "linear-gradient(145deg, #070814, #1a1f3a)",
    scene: "night",
  },
];

export const DEFAULT_EVENTS: CalendarEvent[] = [
  { id: "e1", time: "09:00", title: "Coffee & planning", detail: "Kitchen" },
  { id: "e2", time: "11:15", title: "Group project", detail: "Desk" },
  { id: "e3", time: "14:00", title: "School pickup", detail: "Drive" },
  { id: "e4", time: "17:30", title: "Gym", detail: "Strength" },
  { id: "e5", time: "20:00", title: "Project deep work", detail: "Desk" },
  { id: "e6", time: "10:00", title: "History essay due", detail: "School", dayOffset: 1 },
  { id: "e7", time: "13:00", title: "Team meeting", detail: "Call", dayOffset: 2 },
  { id: "e8", time: "All day", title: "Emma's birthday", detail: "Family", dayOffset: 3 },
];

export const DAILY_FORECAST: { date: string; label: string; high: number; low: number; condition: string; precip: number }[] = [
  { date: "0", label: "Now", high: 13, low: 9, condition: "Cloudy", precip: 35 },
  { date: "1", label: "Thu", high: 12, low: 7, condition: "Rain", precip: 70 },
  { date: "2", label: "Fri", high: 10, low: 6, condition: "Rain", precip: 55 },
  { date: "3", label: "Sat", high: 11, low: 5, condition: "Cloudy", precip: 20 },
  { date: "4", label: "Sun", high: 13, low: 6, condition: "Clear", precip: 5 },
  { date: "5", label: "Mon", high: 12, low: 7, condition: "Cloudy", precip: 15 },
];

export const HOURLY_FORECAST: HourlyForecast[] = [
  { hour: "20:00", temp: 11, condition: "Cloudy", precip: 20, wind: 18 },
  { hour: "21:00", temp: 10, condition: "Cloudy", precip: 35, wind: 20 },
  { hour: "22:00", temp: 9, condition: "Rain", precip: 70, wind: 22 },
  { hour: "23:00", temp: 9, condition: "Rain", precip: 65, wind: 21 },
  { hour: "00:00", temp: 8, condition: "Cloudy", precip: 40, wind: 19 },
  { hour: "01:00", temp: 8, condition: "Cloudy", precip: 25, wind: 17 },
  { hour: "02:00", temp: 7, condition: "Clear", precip: 10, wind: 14 },
  { hour: "03:00", temp: 7, condition: "Clear", precip: 5, wind: 12 },
  { hour: "04:00", temp: 6, condition: "Clear", precip: 5, wind: 11 },
  { hour: "05:00", temp: 7, condition: "Cloudy", precip: 15, wind: 13 },
  { hour: "06:00", temp: 8, condition: "Cloudy", precip: 20, wind: 15 },
  { hour: "07:00", temp: 9, condition: "Cloudy", precip: 25, wind: 16 },
];
