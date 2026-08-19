/** Normalize text so TTS does not spell acronyms, eat A.M., or read visual junk. */

const ABBREV: Record<string, string> = {
  "°c": " degrees",
  "°f": " degrees",
  "°": " degrees",
  kmh: " kilometers per hour",
  "km/h": " kilometers per hour",
  mph: " miles per hour",
  aqi: " air quality ",
  wifi: " wi-fi ",
  ms: " milliseconds ",
};

const PLACE: Record<string, string> = {
  Hafnarfjörður: "Hapnarfyurthur",
  hafnarfjörður: "Hapnarfyurthur",
  Reykjavík: "Raykyavik",
  reykjavík: "Raykyavik",
  Fjörd: "Fyord",
};

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function periodOfDay(hour: number): string {
  if (hour === 0) return "at night";
  if (hour < 12) return "in the morning";
  if (hour < 17) return "in the afternoon";
  if (hour < 21) return "in the evening";
  return "at night";
}

/** Clock time as speech — never the word "am". */
export function speakClock(hour: number, minute = 0): string {
  const h = ((hour % 24) + 24) % 24;
  const m = Math.max(0, Math.min(59, minute));
  if (h === 0 && m === 0) return "midnight";
  if (h === 12 && m === 0) return "noon";
  const h12 = h % 12 || 12;
  const period = periodOfDay(h);
  if (m === 0) return `${h12} ${period}`;
  if (m < 10) return `${h12} oh ${m} ${period}`;
  return `${h12} ${m} ${period}`;
}

function speakClockFromMatch(
  hourRaw: string,
  minuteRaw: string | undefined,
  suffix: string | undefined
): string {
  let h = Number(hourRaw);
  const m = minuteRaw != null && minuteRaw !== "" ? Number(minuteRaw) : 0;
  const ap = (suffix || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m)) {
    return [hourRaw, minuteRaw].filter(Boolean).join(" ");
  }
  return speakClock(h, m);
}

function replaceTimes(text: string): string {
  let t = text;

  // 7 A.M. / 7:30 p.m. / 09:00am — before leftover A.M. handling
  t = t.replace(
    /\b(\d{1,2})(?::(\d{2}))?\s*([ap](?:\.|\s)*m\.?)(?!\w)/gi,
    (_all, hh: string, mm: string | undefined, ap: string) => speakClockFromMatch(hh, mm, ap)
  );

  // 24-hour clocks: 09:00, 22:00, 7:30 (not 1:234)
  t = t.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, (_all, hh: string, mm: string) =>
    speakClockFromMatch(hh, mm, undefined)
  );

  // Bare A.M. / P.M. left over — never the word "am"
  t = t.replace(/\ba\s*\.\s*m\s*\.?/gi, " in the morning ");
  t = t.replace(/\bp\s*\.\s*m\s*\.?/gi, " in the evening ");
  t = t.replace(/\bA\.M\.?\b/g, " in the morning ");
  t = t.replace(/\bP\.M\.?\b/g, " in the evening ");

  return t;
}

function replaceMhm(text: string): string {
  // Windows TTS spells "Mhm" as M. H. M. — force a hummed acknowledgement.
  return text
    .replace(/\b[Mm]{2,}[- ]?[Hh][Mm]+\b/g, "mm hmm")
    .replace(/\bMhm\b/g, "mm hmm")
    .replace(/\bMHM\b/g, "mm hmm")
    .replace(/\bM\.?\s*H\.?\s*M\.?\b/gi, "mm hmm");
}

export function normalizeForSpeech(text: string): string {
  let t = text.trim();
  if (!t) return "";

  t = replaceMhm(t);
  t = t.replace(/```[\s\S]*?```/g, " ");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/https?:\/\/\S+/gi, " link ");
  t = t.replace(/&/g, " and ");

  for (const [k, v] of Object.entries(PLACE)) {
    t = t.replace(new RegExp(escapeReg(k), "g"), v);
  }

  t = t.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, (ip) => ip.split(".").join(" dot "));
  t = replaceTimes(t);
  t = t.replace(/(\d+)\s*°\s*[cC]\b/g, "$1 degrees");
  t = t.replace(/(\d+)\s*°\s*[fF]\b/g, "$1 degrees");
  t = t.replace(/(\d+)\s*°/g, "$1 degrees");
  t = t.replace(/(\d+)\s*%/g, "$1 percent");
  t = t.replace(/(\d+)\s*K\b/g, "$1 kelvin");
  t = t.replace(/\bLEDs\b/gi, "lights");
  t = t.replace(/\bLED\b/g, "L E D");
  t = t.replace(/\*\*?|_+/g, "");
  t = t.replace(/[#>*~]/g, " ");
  t = t.replace(/\b(id|uuid)\s*[:=]\s*\S+/gi, "");

  for (const [k, v] of Object.entries(ABBREV)) {
    t = t.replace(new RegExp(`\\b${escapeReg(k)}\\b`, "gi"), v);
  }

  // Short acknowledgements: don't let "?" get read, keep the hum.
  if (/^(hey|hi|yeah|yep|sure|ok|okay|anytime|mm hmm)\s*[.?!]*$/i.test(t.trim())) {
    t = t.replace(/[.?!]+$/g, "");
  }

  t = t.replace(/\s+/g, " ").trim();
  return t;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeech() {
  currentUtterance = null;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking() {
  return typeof window !== "undefined" && !!window.speechSynthesis?.speaking;
}

export function speak(text: string, onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return false;
  }
  const spoken = normalizeForSpeech(text);
  if (!spoken) {
    onEnd?.();
    return false;
  }
  stopSpeech();
  const u = new SpeechSynthesisUtterance(spoken);
  u.rate = 1.02;
  u.pitch = 1;
  u.onend = () => {
    if (currentUtterance === u) currentUtterance = null;
    onEnd?.();
  };
  u.onerror = () => {
    if (currentUtterance === u) currentUtterance = null;
    onEnd?.();
  };
  currentUtterance = u;
  window.speechSynthesis.speak(u);
  return true;
}
