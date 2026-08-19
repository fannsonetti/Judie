import { bestMatch, normalizeName } from "./fuzzy";

export interface DeviceDef {
  id: string;
  name: string;
  type: "light" | "media" | "purifier" | "climate";
  aliases: string[];
  capabilities: string[];
}

export const DEVICE_DEFS: DeviceDef[] = [
  {
    id: "bed",
    name: "Bed LEDs",
    type: "light",
    aliases: ["bed", "bed leds", "bed light", "bed lights", "bedroom leds"],
    capabilities: ["power", "brightness", "color", "colorTemp", "saturation"],
  },
  {
    id: "sofa",
    name: "Sofa LEDs",
    type: "light",
    aliases: ["sofa", "sofa leds", "couch", "couch leds"],
    capabilities: ["power", "brightness", "color", "colorTemp", "saturation"],
  },
  {
    id: "shelf",
    name: "Shelf LEDs",
    type: "light",
    aliases: ["shelf", "shelf leds", "shelves"],
    capabilities: ["power", "brightness", "color", "colorTemp", "saturation"],
  },
  {
    id: "ceiling",
    name: "Ceiling Light",
    type: "light",
    aliases: ["ceiling", "ceiling light", "overhead", "main light", "main lights"],
    capabilities: ["power", "brightness", "color", "colorTemp", "saturation"],
  },
  {
    id: "desk",
    name: "Desk Light",
    type: "light",
    aliases: ["desk", "desk light", "desk lamp", "lamp", "desk lights"],
    capabilities: ["power", "brightness", "color", "colorTemp", "saturation"],
  },
  {
    id: "media",
    name: "Speakers",
    type: "media",
    aliases: ["speakers", "speaker", "music", "audio", "media", "playback"],
    capabilities: ["play", "volume"],
  },
  {
    id: "purifier",
    name: "Air Purifier",
    type: "purifier",
    aliases: ["purifier", "air purifier", "air filter", "fan"],
    capabilities: ["power", "mode", "fan"],
  },
];

const ALL_LIGHT_WORDS = [
  "lights",
  "light",
  "leds",
  "everything",
  "all the lights",
  "all lights",
  "the room",
];

export function resolveDevice(text: string, type?: DeviceDef["type"]): DeviceDef | undefined {
  const n = normalizeName(text);
  const pool = type ? DEVICE_DEFS.filter((d) => d.type === type) : DEVICE_DEFS;
  return bestMatch(n, pool, (d) => [d.name, d.id, ...d.aliases], 0.7);
}

export function extractDevices(text: string, type?: DeviceDef["type"]): DeviceDef[] {
  const n = normalizeName(text);
  const pool = type ? DEVICE_DEFS.filter((d) => d.type === type) : DEVICE_DEFS;
  const found: DeviceDef[] = [];
  const sorted = [...pool].sort(
    (a, b) =>
      Math.max(...b.aliases.map((x) => x.length), b.name.length) -
      Math.max(...a.aliases.map((x) => x.length), a.name.length)
  );
  for (const d of sorted) {
    const names = [d.name, d.id, ...d.aliases].map(normalizeName).sort((a, b) => b.length - a.length);
    if (names.some((name) => name && n.includes(name))) found.push(d);
  }
  return found;
}

export function refersToAllLights(text: string) {
  const n = normalizeName(text);
  if (/\bexcept\b/.test(n)) return true;
  if (extractDevices(n, "light").length > 0) return false;
  return ALL_LIGHT_WORDS.some((w) => n.includes(w)) || /\b(them|they|those)\b/.test(n);
}

export function extractExcept(text: string): DeviceDef | undefined {
  const m = text.match(/\bexcept(?:\s+for)?\s+(.+)$/i);
  if (!m) return undefined;
  return resolveDevice(m[1], "light");
}
