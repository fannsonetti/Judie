export interface InstallationConfig {
  roomName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  units: "metric" | "imperial";
  tempUnit: "c" | "f" | "k";
  distanceUnit: "km" | "mi" | "nm" | "fur";
  voiceEnabled: boolean;
  speakReplies: boolean;
  assistantBaseUrl: string;
  /** Letterbox the UI to 16:10 so 16:9 screens do not stretch the home grid. */
  lockAspect1610: boolean;
  preferredNet: "wifi" | "ethernet";
  dhcp: boolean;
  sidebar: boolean;
  blockyFont: boolean;
  hideHeaderClock: boolean;
  headerLine: boolean;
  screenOffSecs: number;
  textScale: number;
  uiScale: number;
  headerH: number;
  hitTarget: number;
  volume: number;
  proactive: {
    timers: boolean;
    calendar: boolean;
    weather: boolean;
    air: boolean;
    devices: boolean;
  };
}

export const SCREEN_OFF_OPTIONS: { label: string; secs: number }[] = [
  { label: "1 minute", secs: 60 },
  { label: "2 minutes", secs: 120 },
  { label: "3 minutes", secs: 180 },
  { label: "5 minutes", secs: 300 },
  { label: "10 minutes", secs: 600 },
  { label: "15 minutes", secs: 900 },
  { label: "20 minutes", secs: 1200 },
  { label: "25 minutes", secs: 1500 },
  { label: "30 minutes", secs: 1800 },
  { label: "45 minutes", secs: 2700 },
  { label: "1 hour", secs: 3600 },
  { label: "2 hours", secs: 7200 },
  { label: "3 hours", secs: 10800 },
  { label: "4 hours", secs: 14400 },
  { label: "5 hours", secs: 18000 },
  { label: "Never", secs: 0 },
];

export function screenOffLabel(secs: number) {
  return SCREEN_OFF_OPTIONS.find((o) => o.secs === secs)?.label ?? "Never";
}

export const DEFAULT_INSTALLATION: InstallationConfig = {
  roomName: "Room",
  locationName: "Hafnarfjörður",
  latitude: 64.067,
  longitude: -21.951,
  units: "metric",
  tempUnit: "c",
  distanceUnit: "km",
  voiceEnabled: true,
  speakReplies: true,
  assistantBaseUrl: "http://127.0.0.1:8742",
  lockAspect1610: false,
  preferredNet: "wifi",
  dhcp: true,
  sidebar: false,
  blockyFont: false,
  hideHeaderClock: false,
  headerLine: false,
  screenOffSecs: 0,
  textScale: 100,
  uiScale: 100,
  headerH: 108,
  hitTarget: 72,
  volume: 62,
  proactive: {
    timers: true,
    calendar: true,
    weather: true,
    air: true,
    devices: true,
  },
};
