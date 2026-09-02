import { RoomAction, RoutineSnap } from "../assistant/types";

export const BUILTIN_ROUTINES: RoutineSnap[] = [
  {
    id: "goodNight",
    name: "Good Night",
    phrases: ["good night", "goodnight", "bedtime", "i am going to bed", "i am off to bed"],
    builtin: true,
    enabled: true,
    actions: [
      { type: "lights.scene", scene: "Night" },
      { type: "media.volume", value: 12 },
      { type: "media.play", playing: false },
      { type: "dnd", on: true },
    ],
  },
  {
    id: "movie",
    name: "Movie",
    phrases: ["movie mode", "movie time", "watch a movie", "start movie"],
    builtin: true,
    enabled: true,
    actions: [
      { type: "lights.scene", scene: "Movie" },
      { type: "media.volume", value: 35 },
    ],
  },
  {
    id: "away",
    name: "Away",
    phrases: ["away mode", "i am leaving", "i am heading out", "lock up"],
    builtin: true,
    enabled: true,
    actions: [
      { type: "lights.power", on: false },
      { type: "media.play", playing: false },
      { type: "purifier.mode", mode: "auto" },
    ],
  },
  {
    id: "morning",
    name: "Morning",
    phrases: ["morning mode", "start the day", "good morning"],
    builtin: true,
    enabled: true,
    actions: [
      { type: "lights.scene", scene: "Bright" },
      { type: "dnd", on: false },
      { type: "purifier.mode", mode: "auto" },
    ],
  },
  {
    id: "home",
    name: "Home",
    phrases: ["i am home", "i am back", "i am back home"],
    builtin: true,
    enabled: true,
    actions: [
      { type: "lights.power", on: true },
      { type: "dnd", on: false },
      { type: "purifier.mode", mode: "auto" },
    ],
  },
];

export function describeAction(action: RoomAction): string {
  switch (action.type) {
    case "lights.power":
      return action.on ? "Lights on" : "Lights off";
    case "lights.brightness":
      return action.relative
        ? `Brightness ${action.value > 0 ? "+" : ""}${action.value}`
        : `Brightness ${action.value}%`;
    case "lights.color":
      return "Light colour changed";
    case "lights.colorTemp":
      return "Colour temperature changed";
    case "lights.saturation":
      return "Saturation changed";
    case "lights.scene":
      return `${action.scene} scene`;
    case "media.play":
      if (action.playing === false) return "Paused playback";
      return "Playback started";
    case "media.skip":
      return action.direction === "next" ? "Next track" : "Previous track";
    case "media.volume":
      return action.relative ? "Volume adjusted" : `Volume ${action.value}`;
    case "media.mute":
      return action.on ? "Muted" : "Unmuted";
    case "purifier.power":
      return action.on ? "Purifier on" : "Purifier off";
    case "purifier.mode":
      return `Purifier ${action.mode}`;
    case "purifier.fan":
      return `Fan ${action.value}%`;
    case "dnd":
      return action.on ? "Do not disturb on" : "Do not disturb off";
    case "timer.create":
      return `Timer: ${action.name}`;
    case "alarm.create":
      return `Alarm ${action.hour}:${action.minute.toString().padStart(2, "0")}`;
    case "timer.cancel":
      return "Timer cancelled";
    case "routine.create":
      return `Routine “${action.phrase}” saved`;
    case "routine.delete":
      return "Routine removed";
    default:
      return "Action";
  }
}
