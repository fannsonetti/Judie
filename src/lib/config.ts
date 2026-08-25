export interface InstallationConfig {
  roomName: string;
  locationName: string;
  latitude: number;
  longitude: number;
  units: "metric" | "imperial";
  voiceEnabled: boolean;
  speakReplies: boolean;
  assistantBaseUrl: string;
  /** Letterbox the UI to 16:10 so 16:9 screens do not stretch the home grid. */
  lockAspect1610: boolean;
  proactive: {
    timers: boolean;
    calendar: boolean;
    weather: boolean;
    air: boolean;
    devices: boolean;
  };
}

export const DEFAULT_INSTALLATION: InstallationConfig = {
  roomName: "Room",
  locationName: "Hafnarfjörður",
  latitude: 64.067,
  longitude: -21.951,
  units: "metric",
  voiceEnabled: true,
  speakReplies: true,
  assistantBaseUrl: "http://127.0.0.1:8742",
  lockAspect1610: false,
  proactive: {
    timers: true,
    calendar: true,
    weather: true,
    air: true,
    devices: true,
  },
};
