export const COLOR_HEX: Record<string, string> = {
  red: "#FF5A5A",
  crimson: "#FF5A5A",
  blue: "#2D7BFF",
  green: "#7CF29C",
  yellow: "#FFD166",
  orange: "#FF8C42",
  purple: "#7B61FF",
  violet: "#7B61FF",
  pink: "#FF6BCB",
  magenta: "#FF6BCB",
  cyan: "#5EEAD4",
  teal: "#2DD4BF",
  white: "#FFFFFF",
  amber: "#FFB366",
  lime: "#84CC16",
  warm: "#FFB366",
  "warm white": "#FFB366",
  "cool white": "#E8F0FF",
  daylight: "#E8F0FF",
  gold: "#FFD166",
};

export const SWATCHES = [
  "#FF5A5A",
  "#FF8C42",
  "#FFD166",
  "#7CF29C",
  "#2D7BFF",
  "#7B61FF",
  "#FF6BCB",
  "#FFFFFF",
];

export function colorFromName(name: string): string | undefined {
  return COLOR_HEX[name.trim().toLowerCase()];
}

export function colorTempToHex(kelvin: number) {
  const t = Math.max(0, Math.min(1, (kelvin - 2200) / (6500 - 2200)));
  const r = 255;
  const g = Math.round(180 + t * 55);
  const b = Math.round(120 + t * 120);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
