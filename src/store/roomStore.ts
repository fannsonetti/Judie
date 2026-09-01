import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_EVENTS,
  DEFAULT_LIGHTS,
  DEFAULT_QUEUE,
  HOURLY_FORECAST,
  DAILY_FORECAST,
  LightGroup,
  LightScene,
  MediaTrack,
  PurifierState,
  SCENE_PRESETS,
  CalendarEvent,
  HourlyForecast,
} from "../lib/mockData";
import { clamp, colorTempToHex } from "../lib/colors";
import { comfortLabel } from "../lib/comfort";
import { BUILTIN_ROUTINES } from "../lib/routines";
import { parseHourMinute } from "../lib/time";
import {
  ActionSource,
  RoomAction,
  RoomSnapshot,
  RoutineSnap,
  TimerSnap,
  WeatherDay,
} from "../assistant/types";

export interface WeatherState {
  location: string;
  temp: number;
  condition: string;
  high: number;
  low: number;
  precipNote: string;
  humidity: number;
  wind: number;
  feel: string;
  hourly: HourlyForecast[];
  daily: WeatherDay[];
  fetchedAt: number;
  stale: boolean;
}

interface UndoSnap {
  lights: LightGroup[];
  scene: LightScene;
  doNotDisturb: boolean;
  media: RoomState["media"];
  purifier: PurifierState;
}

interface RoomState {
  lights: LightGroup[];
  masterOn: boolean;
  masterBrightness: number;
  masterColor: string;
  masterColorTemp: number;
  masterSaturation: number;
  scene: LightScene;
  doNotDisturb: boolean;

  media: {
    playing: boolean;
    progress: number;
    volume: number;
    previousVolume?: number;
    trackIndex: number;
    queue: MediaTrack[];
  };

  climate: {
    indoorTemp: number;
    outdoorTemp: number;
    humidity: number;
    comfort: string;
  };

  weather: WeatherState;
  purifier: PurifierState;
  events: CalendarEvent[];
  timers: TimerSnap[];
  routines: RoutineSnap[];
  undoStack: UndoSnap[];

  server: {
    online: boolean;
    latency: number;
    services: { name: string; online: boolean; latency: number }[];
  };

  setMasterPower: (on: boolean) => void;
  setMasterBrightness: (v: number) => void;
  setMasterColor: (color: string) => void;
  setMasterColorTemp: (v: number) => void;
  setMasterSaturation: (v: number) => void;
  setScene: (scene: LightScene) => void;
  updateLight: (id: string, patch: Partial<LightGroup>) => void;
  toggleLight: (id: string) => void;

  togglePlay: () => void;
  playTrack: (index: number) => void;
  setProgress: (v: number) => void;
  setVolume: (v: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  tickProgress: () => void;

  togglePurifier: () => void;
  setPurifierMode: (mode: PurifierState["mode"]) => void;
  setFanSpeed: (v: number) => void;

  toggleDoNotDisturb: () => void;
  applyQuickControl: (action: "goodNight" | "lightsOff" | "dnd" | "movie") => void;

  setServerStatus: (online: boolean, latency: number) => void;
  setServices: (services: RoomState["server"]["services"]) => void;
  setWeather: (weather: WeatherState) => void;
  addEvent: (event: CalendarEvent) => void;
  removeEvent: (id: string) => void;

  applyActions: (actions: RoomAction[], source?: ActionSource) => void;
  undo: () => boolean;
  snapshot: (lastActivity?: { title: string; source: string; ts: number }) => RoomSnapshot;
  dueTimers: () => TimerSnap[];
  completeTimer: (id: string) => void;
  addRoutine: (phrase: string, command: string, name?: string) => void;
  removeRoutine: (id: string) => void;
}

function syncMasterFromLights(lights: LightGroup[]) {
  const onLights = lights.filter((l) => l.on);
  const anyOn = onLights.length > 0;
  const brightness = anyOn
    ? Math.round(onLights.reduce((s, l) => s + l.brightness, 0) / onLights.length)
    : 0;
  const color = onLights[0]?.color ?? "#FFB366";
  const colorTemp = onLights[0]?.colorTemp ?? 3000;
  const saturation = onLights[0]?.saturation ?? 35;
  return {
    masterOn: anyOn,
    masterBrightness: brightness,
    masterColor: color,
    masterColorTemp: colorTemp,
    masterSaturation: saturation,
  };
}

function targetIds(lights: LightGroup[], ids?: string[]) {
  if (!ids?.length) return lights.map((l) => l.id);
  return ids;
}

function captureUndo(s: RoomState): UndoSnap {
  return {
    lights: s.lights.map((l) => ({ ...l })),
    scene: s.scene,
    doNotDisturb: s.doNotDisturb,
    media: { ...s.media, queue: s.media.queue },
    purifier: { ...s.purifier },
  };
}

function applyOne(s: RoomState, action: RoomAction): Partial<RoomState> {
  switch (action.type) {
    case "lights.power": {
      const ids = new Set(targetIds(s.lights, action.ids));
      const lights = s.lights.map((l) => (ids.has(l.id) ? { ...l, on: action.on } : l));
      return { lights, ...syncMasterFromLights(lights) };
    }
    case "lights.brightness": {
      const ids = new Set(targetIds(s.lights, action.ids));
      const lights = s.lights.map((l) => {
        if (!ids.has(l.id)) return l;
        const brightness = clamp(
          action.relative ? l.brightness + action.value : action.value,
          0,
          100
        );
        return { ...l, brightness, on: brightness > 0 };
      });
      return { lights, ...syncMasterFromLights(lights) };
    }
    case "lights.color": {
      const ids = new Set(targetIds(s.lights, action.ids));
      const lights = s.lights.map((l) =>
        ids.has(l.id) ? { ...l, color: action.color, on: true } : l
      );
      return { lights, ...syncMasterFromLights(lights) };
    }
    case "lights.colorTemp": {
      const ids = new Set(targetIds(s.lights, action.ids));
      const lights = s.lights.map((l) => {
        if (!ids.has(l.id)) return l;
        const colorTemp = clamp(
          action.relative ? l.colorTemp + action.value : action.value,
          2200,
          6500
        );
        return { ...l, colorTemp, color: colorTempToHex(colorTemp), on: true };
      });
      return { lights, ...syncMasterFromLights(lights) };
    }
    case "lights.saturation": {
      const ids = new Set(targetIds(s.lights, action.ids));
      const lights = s.lights.map((l) =>
        ids.has(l.id)
          ? {
              ...l,
              saturation: clamp(
                action.relative ? l.saturation + action.value : action.value,
                0,
                100
              ),
            }
          : l
      );
      return { lights, ...syncMasterFromLights(lights) };
    }
    case "lights.scene": {
      const scene = action.scene as LightScene;
      const preset = SCENE_PRESETS[scene];
      if (!preset) return {};
      const lights = s.lights.map((l) => ({
        ...l,
        on: true,
        brightness: preset.brightness,
        color: preset.color,
        colorTemp: preset.colorTemp,
        saturation: preset.saturation,
      }));
      return {
        scene,
        lights,
        masterOn: true,
        masterBrightness: preset.brightness,
        masterColor: preset.color,
        masterColorTemp: preset.colorTemp,
        masterSaturation: preset.saturation,
      };
    }
    case "media.play": {
      const patch: Partial<RoomState["media"]> = {};
      if (action.playing != null) patch.playing = action.playing;
      if (action.trackIndex != null) {
        patch.trackIndex = action.trackIndex;
        patch.progress = 0;
        patch.playing = true;
      }
      return { media: { ...s.media, ...patch } };
    }
    case "media.skip": {
      const len = s.media.queue.length;
      const trackIndex =
        action.direction === "next"
          ? (s.media.trackIndex + 1) % len
          : (s.media.trackIndex - 1 + len) % len;
      return { media: { ...s.media, trackIndex, progress: 0 } };
    }
    case "media.volume": {
      const volume = clamp(
        action.relative ? s.media.volume + action.value : action.value,
        0,
        100
      );
      return { media: { ...s.media, volume } };
    }
    case "media.mute": {
      if (action.on) {
        const previousVolume =
          s.media.volume > 0 ? s.media.volume : s.media.previousVolume || 45;
        return { media: { ...s.media, previousVolume, volume: 0 } };
      }
      return {
        media: {
          ...s.media,
          volume: s.media.previousVolume || 45,
        },
      };
    }
    case "purifier.power":
      return { purifier: { ...s.purifier, on: action.on } };
    case "purifier.mode":
      return {
        purifier: {
          ...s.purifier,
          mode: action.mode,
          on: true,
          fanSpeed:
            action.mode === "sleep" ? 15 : action.mode === "auto" ? 42 : s.purifier.fanSpeed,
        },
      };
    case "purifier.fan":
      return {
        purifier: {
          ...s.purifier,
          fanSpeed: clamp(action.value, 10, 100),
          mode: "manual",
          on: true,
        },
      };
    case "dnd":
      return { doNotDisturb: action.on };
    case "timer.create": {
      const timer: TimerSnap = {
        id: `t-${Date.now().toString(36)}`,
        name: action.name,
        kind: "timer",
        fireAt: Date.now() + action.durationMs,
        createdAt: Date.now(),
        fireText: action.fireText,
      };
      return { timers: [...s.timers, timer] };
    }
    case "alarm.create": {
      const fireAt = parseHourMinute(action.hour, action.minute).getTime();
      const timer: TimerSnap = {
        id: `a-${Date.now().toString(36)}`,
        name: action.name,
        kind: "alarm",
        fireAt,
        createdAt: Date.now(),
      };
      return { timers: [...s.timers, timer] };
    }
    case "timer.cancel": {
      if (action.all) return { timers: [] };
      if (action.id) return { timers: s.timers.filter((t) => t.id !== action.id) };
      return { timers: s.timers.slice(0, -1) };
    }
    case "routine.create": {
      const id = `r-${Date.now().toString(36)}`;
      const phrase = action.phrase.trim();
      const name = (action.name ?? phrase).trim() || phrase;
      const routine: RoutineSnap = {
        id,
        name,
        phrases: [phrase.toLowerCase()],
        command: action.command.trim(),
      };
      return { routines: [...s.routines.filter((r) => r.id !== id), routine] };
    }
    case "routine.delete":
      return { routines: s.routines.filter((r) => r.id !== action.id || r.builtin) };
    default:
      return {};
  }
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      lights: DEFAULT_LIGHTS,
      ...syncMasterFromLights(DEFAULT_LIGHTS),
      scene: "Cozy",
      doNotDisturb: false,
      undoStack: [],
      timers: [],
      routines: BUILTIN_ROUTINES,

      media: {
        playing: false,
        progress: 42,
        volume: 62,
        trackIndex: 0,
        queue: DEFAULT_QUEUE,
      },

      climate: {
        indoorTemp: 21.4,
        outdoorTemp: 11,
        humidity: 42,
        comfort: "Comfortable",
      },

      weather: {
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
        fetchedAt: 0,
        stale: true,
      },

      purifier: {
        on: true,
        mode: "auto",
        fanSpeed: 42,
        airQuality: "Good",
        aqi: 28,
        filterHealth: 76,
      },

      events: DEFAULT_EVENTS,

      server: {
        online: true,
        latency: 4,
        services: [
          { name: "Core", online: true, latency: 4 },
          { name: "Lights", online: true, latency: 6 },
          { name: "Media", online: true, latency: 9 },
          { name: "Weather", online: false, latency: 0 },
          { name: "Assistant", online: false, latency: 0 },
        ],
      },

      setMasterPower: (on) =>
        set((s) => {
          const lights = s.lights.map((l) => ({ ...l, on }));
          return { lights, masterOn: on, masterBrightness: on ? s.masterBrightness || 72 : 0 };
        }),

      setMasterBrightness: (v) =>
        set((s) => {
          const brightness = clamp(v, 0, 100);
          const lights = s.lights.map((l) =>
            l.on || brightness > 0 ? { ...l, on: brightness > 0, brightness } : l
          );
          return { lights, masterBrightness: brightness, masterOn: brightness > 0 };
        }),

      setMasterColor: (color) =>
        set((s) => ({
          masterColor: color,
          lights: s.lights.map((l) => (l.on ? { ...l, color } : l)),
        })),

      setMasterColorTemp: (v) =>
        set((s) => {
          const colorTemp = clamp(v, 2200, 6500);
          const color = colorTempToHex(colorTemp);
          return {
            masterColorTemp: colorTemp,
            masterColor: color,
            lights: s.lights.map((l) => (l.on ? { ...l, colorTemp, color } : l)),
          };
        }),

      setMasterSaturation: (v) =>
        set((s) => ({
          masterSaturation: clamp(v, 0, 100),
          lights: s.lights.map((l) => (l.on ? { ...l, saturation: clamp(v, 0, 100) } : l)),
        })),

      setScene: (scene) => get().applyActions([{ type: "lights.scene", scene }], "user"),

      updateLight: (id, patch) =>
        set((s) => {
          const lights = s.lights.map((l) => (l.id === id ? { ...l, ...patch } : l));
          return { lights, ...syncMasterFromLights(lights) };
        }),

      toggleLight: (id) =>
        set((s) => {
          const lights = s.lights.map((l) => (l.id === id ? { ...l, on: !l.on } : l));
          return { lights, ...syncMasterFromLights(lights) };
        }),

      togglePlay: () => set((s) => ({ media: { ...s.media, playing: !s.media.playing } })),

      playTrack: (index) =>
        set((s) => ({
          media: {
            ...s.media,
            trackIndex: clamp(index, 0, s.media.queue.length - 1),
            progress: 0,
            playing: true,
          },
        })),

      setProgress: (v) => set((s) => ({ media: { ...s.media, progress: v } })),

      setVolume: (v) =>
        set((s) => ({ media: { ...s.media, volume: clamp(v, 0, 100) } })),

      nextTrack: () =>
        set((s) => ({
          media: {
            ...s.media,
            trackIndex: (s.media.trackIndex + 1) % s.media.queue.length,
            progress: 0,
          },
        })),

      prevTrack: () =>
        set((s) => ({
          media: {
            ...s.media,
            trackIndex: (s.media.trackIndex - 1 + s.media.queue.length) % s.media.queue.length,
            progress: 0,
          },
        })),

      tickProgress: () => {
        const { media } = get();
        if (!media.playing) return;
        const track = media.queue[media.trackIndex];
        const next = media.progress + 1;
        if (next >= track.duration) {
          get().nextTrack();
          set((s) => ({ media: { ...s.media, playing: true } }));
        } else {
          set((s) => ({ media: { ...s.media, progress: next } }));
        }
      },

      togglePurifier: () =>
        set((s) => ({ purifier: { ...s.purifier, on: !s.purifier.on } })),

      setPurifierMode: (mode) =>
        set((s) => ({
          purifier: {
            ...s.purifier,
            mode,
            fanSpeed: mode === "sleep" ? 15 : mode === "auto" ? 42 : s.purifier.fanSpeed,
          },
        })),

      setFanSpeed: (v) =>
        set((s) => ({
          purifier: { ...s.purifier, fanSpeed: clamp(v, 10, 100), mode: "manual", on: true },
        })),

      toggleDoNotDisturb: () => set((s) => ({ doNotDisturb: !s.doNotDisturb })),

      applyQuickControl: (action) => {
        if (action === "dnd") {
          get().toggleDoNotDisturb();
          return;
        }
        if (action === "lightsOff") {
          get().applyActions([{ type: "lights.power", on: false }], "user");
          return;
        }
        const id = action === "goodNight" ? "goodNight" : "movie";
        const routine = get().routines.find((r) => r.id === id);
        if (routine?.actions) get().applyActions(routine.actions, "routine");
      },

      setServerStatus: (online, latency) =>
        set((s) => ({
          server: {
            ...s.server,
            online,
            latency,
            services: s.server.services.map((svc) =>
              svc.name === "Core" ? { ...svc, online, latency } : svc
            ),
          },
        })),

      setServices: (services) =>
        set((s) => ({ server: { ...s.server, services } })),

      setWeather: (weather) =>
        set((s) => ({
          weather,
          climate: {
            ...s.climate,
            outdoorTemp: weather.temp,
            comfort: comfortLabel(s.climate.indoorTemp, s.climate.humidity),
          },
        })),

      addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),

      applyActions: (actions, _source = "user") => {
        if (!actions.length) return;
        set((s) => {
          let next: RoomState = { ...s, undoStack: [...s.undoStack, captureUndo(s)].slice(-20) };
          for (const action of actions) {
            next = { ...next, ...applyOne(next, action) };
          }
          return next;
        });
      },

      undo: () => {
        const stack = get().undoStack;
        const last = stack[stack.length - 1];
        if (!last) return false;
        set({
          lights: last.lights,
          ...syncMasterFromLights(last.lights),
          scene: last.scene,
          doNotDisturb: last.doNotDisturb,
          media: last.media,
          purifier: last.purifier,
          undoStack: stack.slice(0, -1),
        });
        return true;
      },

      snapshot: (lastActivity) => {
        const s = get();
        return {
          lights: s.lights,
          scene: s.scene,
          doNotDisturb: s.doNotDisturb,
          media: s.media,
          climate: s.climate,
          weather: s.weather,
          purifier: s.purifier,
          events: s.events,
          timers: s.timers,
          routines: s.routines,
          server: s.server,
          lastActivity,
        };
      },

      dueTimers: () => get().timers.filter((t) => t.fireAt <= Date.now()),

      completeTimer: (id) => set((s) => ({ timers: s.timers.filter((t) => t.id !== id) })),

      addRoutine: (phrase, command, name) =>
        get().applyActions([{ type: "routine.create", phrase, command, name }], "user"),

      removeRoutine: (id) => get().applyActions([{ type: "routine.delete", id }], "user"),
    }),
    {
      name: "judie-room",
      partialize: (s) => ({
        lights: s.lights,
        scene: s.scene,
        doNotDisturb: s.doNotDisturb,
        media: { ...s.media, playing: false },
        purifier: s.purifier,
        events: s.events,
        timers: s.timers.filter((t) => t.fireAt > Date.now()),
        routines: s.routines,
      }),
      merge: (persisted, current) => {
        const p = (persisted as Partial<RoomState>) ?? {};
        const routines = [
          ...BUILTIN_ROUTINES,
          ...(p.routines ?? []).filter((r) => !r.builtin),
        ];
        const lights = p.lights?.length ? p.lights : current.lights;
        const events = p.events ?? current.events;
        const eventIds = new Set(events.map((e) => e.id));
        const extras = DEFAULT_EVENTS.filter((e) => e.dayOffset && !eventIds.has(e.id));
        return {
          ...current,
          ...p,
          lights,
          ...syncMasterFromLights(lights),
          events: [...events, ...extras],
          routines,
          undoStack: [],
          media: { ...current.media, ...p.media, playing: false, queue: DEFAULT_QUEUE },
        };
      },
    }
  )
);
