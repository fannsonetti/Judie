import { COLOR_HEX } from "../lib/colors";
import { extractDevices, extractExcept } from "../lib/devices";
import { SCENE_PRESETS } from "../lib/mockData";

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  half: 50,
  full: 100,
  max: 100,
  maximum: 100,
  min: 1,
  minimum: 1,
};

export interface Entities {
  deviceIds: string[];
  exceptId?: string;
  on?: boolean;
  percent?: number;
  relative?: number;
  color?: string;
  scene?: string;
  dayOffset?: number;
  hour?: number;
  minute?: number;
  durationMs?: number;
  query?: string;
  phrase?: string;
  command?: string;
  indoor?: boolean;
  outdoor?: boolean;
  person?: string;
}

const RELATIVE_SMALL = /\b(a little|a bit|slightly|somewhat)\b/;
const RELATIVE_LARGE = /\b(a lot|much|way)\b/;

export function extractEntities(text: string): Entities {
  const e: Entities = { deviceIds: [] };

  const lights = extractDevices(text, "light");
  const others = extractDevices(text).filter((d) => d.type !== "light");
  e.deviceIds = [...new Set([...lights, ...others].map((d) => d.id))];

  const except = extractExcept(text);
  if (except) e.exceptId = except.id;

  if (/\b(on|enable|activate)\b/.test(text) && !/\boff\b/.test(text)) e.on = true;
  if (/\b(off|kill|disable|dark|shutdown|shut down)\b/.test(text)) e.on = false;

  const pct = text.match(/(\d{1,3})\s*(%|percent)?/);
  if (pct) {
    const n = Number(pct[1]);
    if (n <= 100) e.percent = n;
  }
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(text) && e.percent == null) e.percent = n;
  }

  if (RELATIVE_SMALL.test(text)) e.relative = 10;
  else if (RELATIVE_LARGE.test(text)) e.relative = 25;
  else if (/\b(brighter|dimmer|darker|louder|quieter|warmer|cooler|up|down)\b/.test(text)) {
    e.relative = 15;
  }

  for (const name of Object.keys(COLOR_HEX).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      e.color = COLOR_HEX[name];
      break;
    }
  }

  for (const scene of Object.keys(SCENE_PRESETS)) {
    if (text.includes(scene.toLowerCase())) e.scene = scene;
  }
  if (/\bmovie mode\b/.test(text) || /\bmovie\b/.test(text)) e.scene = e.scene || "Movie";
  if (/\bgood ?night\b|\bnight mode\b|\bbedtime\b/.test(text)) e.scene = e.scene || "Night";

  if (/\btomorrow\b/.test(text)) e.dayOffset = 1;
  else if (/\btoday\b/.test(text)) e.dayOffset = 0;

  if (/\b(outside|outdoor|weather|forecast)\b/.test(text)) e.outdoor = true;
  if (/\b(inside|indoor|in here|in the room)\b/.test(text)) e.indoor = true;

  const dur = parseDuration(text);
  if (dur) e.durationMs = dur;

  const clock = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
  if (clock && !e.durationMs) {
    let h = Number(clock[1]);
    const m = Number(clock[2] || 0);
    const ap = clock[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h >= 0 && h <= 23) {
      e.hour = h;
      e.minute = m;
    }
  }

  const teach = text.match(/^when i (?:say|say the words) ["']?(.+?)["']?\s*,\s*(.+)$/);
  if (teach) {
    e.phrase = teach[1].trim();
    e.command = teach[2].trim();
  }

  const person = namedPerson(text);
  if (person) e.person = person;

  return e;
}

/** Pull a referred person/thing out of "who is X" / "do you know who X is". */
export function namedPerson(text: string): string | null {
  const t = text.toLowerCase().replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
  const know = t.match(/\b(?:do you know who|who (?:the heck |the hell )?)(.+?) is\b/);
  if (know) {
    const name = cleanEntity(know[1]);
    if (name) return name;
  }
  const who = t.match(/\bwho (?:is|was|are) (.+)$/);
  if (who) {
    const name = cleanEntity(who[1]);
    if (name && !/^(you|this|that|it)$/.test(name)) return name;
  }
  const about = t.match(/\btell me about (.+)$/);
  if (about) return cleanEntity(about[1]);
  return null;
}

function cleanEntity(raw: string) {
  return raw
    .replace(/^(a |an |the |who )/, "")
    .replace(/\b(anyway|again|then|please)$/, "")
    .trim();
}

function durationAmount(text: string): string {
  let t = text.toLowerCase();
  const words: [string, string][] = [
    ["a hundred", "100"],
    ["ninety", "90"],
    ["eighty", "80"],
    ["seventy", "70"],
    ["sixty", "60"],
    ["fifty", "50"],
    ["forty", "40"],
    ["thirty", "30"],
    ["twenty", "20"],
    ["fifteen", "15"],
    ["fourteen", "14"],
    ["thirteen", "13"],
    ["twelve", "12"],
    ["eleven", "11"],
    ["ten", "10"],
    ["nine", "9"],
    ["eight", "8"],
    ["seven", "7"],
    ["six", "6"],
    ["five", "5"],
    ["four", "4"],
    ["three", "3"],
    ["two", "2"],
    ["one", "1"],
  ];
  for (const [w, n] of words) {
    t = t.replace(new RegExp(`\\b${w}\\b`, "g"), n);
  }
  return t;
}

export function parseDuration(text: string): number | undefined {
  const t = durationAmount(text);
  let ms = 0;
  const hours = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?)\b/);
  const mins = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?)\b/);
  const secs = t.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?)\b/);
  const inMins = t.match(/\bin\s+(\d+)\b/) && !hours && !mins && !secs;
  if (hours) ms += Number(hours[1]) * 3600_000;
  if (mins) ms += Number(mins[1]) * 60_000;
  if (secs) ms += Number(secs[1]) * 1000;
  if (inMins) {
    const n = t.match(/\bin\s+(\d+)\b/);
    if (n) ms += Number(n[1]) * 60_000;
  }
  if (/\ban hour\b/.test(text)) ms = Math.max(ms, 3600_000);
  if (/\ba minute\b/.test(text)) ms = Math.max(ms, 60_000);
  if (/\ba few minutes\b/.test(text)) ms = Math.max(ms, 5 * 60_000);
  if (/\bhalf an hour\b|\ba half hour\b/.test(text)) ms = Math.max(ms, 1800_000);
  if (/\ba quarter hour\b|\bquarter of an hour\b/.test(text)) ms = Math.max(ms, 15 * 60_000);
  return ms || undefined;
}

export function resolveScene(text: string) {
  const t = text.toLowerCase();
  if (t.includes("cozy") || t.includes("cosy")) return "Cozy";
  if (t.includes("movie")) return "Movie";
  if (t.includes("night") || t.includes("bedtime") || t.includes("sleep")) return "Night";
  if (t.includes("bright") || t.includes("day")) return "Bright";
  if (t.includes("gaming") || t.includes("game")) return "Gaming";
  return undefined;
}
