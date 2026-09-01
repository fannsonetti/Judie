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
  tempUnit: "c",
  distanceUnit: "km",
  voiceEnabled: true,
  speakReplies: true,
  assistantBaseUrl: "http://127.0.0.1:8742",
  lockAspect1610: false,
  preferredNet: "wifi",
  dhcp: true,
  proactive: {
    timers: true,
    calendar: true,
    weather: true,
    air: true,
    devices: true,
  },
};
