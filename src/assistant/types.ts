export type ActionSource =
  | "user"
  | "assistant"
  | "routine"
  | "timer"
  | "automation"
  | "system";

export type PurifierMode = "auto" | "manual" | "sleep";

export type RoomAction =
  | { type: "lights.power"; ids?: string[]; on: boolean }
  | { type: "lights.brightness"; ids?: string[]; value: number; relative?: boolean }
  | { type: "lights.color"; ids?: string[]; color: string }
  | { type: "lights.colorTemp"; ids?: string[]; value: number; relative?: boolean }
  | { type: "lights.saturation"; ids?: string[]; value: number; relative?: boolean }
  | { type: "lights.scene"; scene: string }
  | { type: "media.play"; playing?: boolean; trackIndex?: number }
  | { type: "media.skip"; direction: "next" | "prev" }
  | { type: "media.volume"; value: number; relative?: boolean }
  | { type: "media.mute"; on: boolean }
  | { type: "purifier.power"; on: boolean }
  | { type: "purifier.mode"; mode: PurifierMode }
  | { type: "purifier.fan"; value: number }
  | { type: "dnd"; on: boolean }
  | { type: "timer.create"; name: string; durationMs: number; fireText?: string }
  | { type: "alarm.create"; name: string; hour: number; minute: number }
  | { type: "timer.cancel"; id?: string; all?: boolean }
  | { type: "routine.create"; phrase: string; command: string; name?: string }
  | { type: "routine.delete"; id: string };

export interface LightSnap {
  id: string;
  name: string;
  on: boolean;
  brightness: number;
  color: string;
  colorTemp: number;
  saturation: number;
}

export interface MediaSnap {
  playing: boolean;
  progress: number;
  volume: number;
  previousVolume?: number;
  trackIndex: number;
  queue: { id: string; title: string; artist: string; album: string; duration: number }[];
}

export interface PurifierSnap {
  on: boolean;
  mode: PurifierMode;
  fanSpeed: number;
  airQuality: string;
  aqi: number;
  filterHealth: number;
}

export interface ClimateSnap {
  indoorTemp: number;
  outdoorTemp: number;
  humidity: number;
  comfort: string;
}

export interface WeatherDay {
  date: string;
  label: string;
  high: number;
  low: number;
  condition: string;
  precip: number;
}

export interface WeatherSnap {
  location: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  precipNote: string;
  humidity: number;
  wind: number;
  feel?: string;
  hourly: { hour: string; temp: number; condition: string; precip: number; wind: number }[];
  daily?: WeatherDay[];
}

export interface CalendarSnap {
  id: string;
  time: string;
  title: string;
  detail?: string;
  dayOffset?: number;
}

export interface TimerSnap {
  id: string;
  name: string;
  kind: "timer" | "alarm";
  fireAt: number;
  createdAt: number;
  fireText?: string;
}

export interface RoutineSnap {
  id: string;
  name: string;
  phrases: string[];
  command?: string;
  builtin?: boolean;
  enabled?: boolean;
  actions?: RoomAction[];
}

export interface RoomSnapshot {
  lights: LightSnap[];
  scene: string;
  doNotDisturb: boolean;
  media: MediaSnap;
  climate: ClimateSnap;
  weather: WeatherSnap;
  purifier: PurifierSnap;
  events: CalendarSnap[];
  timers: TimerSnap[];
  routines: RoutineSnap[];
  server: {
    online: boolean;
    latency: number;
    services: { name: string; online: boolean; latency: number }[];
  };
  lastActivity?: { title: string; source: string; ts: number };
}

export interface ConversationContext {
  lastIntent: string | null;
  lastDomain: string | null;
  lastDeviceIds: string[];
  lastAction: string | null;
  updatedAt: number;
  lastMath?: number;
  lastResponse?: string;
  lastUtterance?: string;
  lastRelative?: { kind: "brightness" | "volume" | "temp"; sign: 1 | -1 };
  lastSuccess?: boolean;
  game?: { kind: "rps" | "guess"; secret?: number; startedAt: number } | null;
}

export function emptyContext(): ConversationContext {
  return {
    lastIntent: null,
    lastDomain: null,
    lastDeviceIds: [],
    lastAction: null,
    updatedAt: 0,
    lastMath: undefined,
    lastResponse: undefined,
    lastUtterance: undefined,
    lastRelative: undefined,
    lastSuccess: undefined,
    game: null,
  };
}

export const CONTEXT_TTL_MS = 90_000;

export interface ClauseResult {
  intent: string | null;
  confidence: number;
  entities: Record<string, unknown>;
  actions: RoomAction[];
  response: string;
  spoken?: string;
  success: boolean;
  usedContext: boolean;
  clarification?: string;
  lastMath?: number;
  lastRelative?: ConversationContext["lastRelative"];
  game?: ConversationContext["game"];
  gameTouched?: boolean;
  route?: string;
  candidates?: { name: string; confidence: number; source: string }[];
}

export interface ProcessResult {
  success: boolean;
  response: string;
  spoken: string;
  actions: RoomAction[];
  intent: string | null;
  confidence: number;
  entities: Record<string, unknown>;
  usedContext: boolean;
  clauses: ClauseResult[];
  lastMath?: number;
  lastRelative?: ConversationContext["lastRelative"];
  game?: ConversationContext["game"];
  debug: {
    normalized: string;
    clauses: string[];
    ms: number;
    route?: string;
    candidates?: { name: string; confidence: number; source: string }[];
    bestCandidate?: { name: string; confidence: number; source: string };
  };
}
