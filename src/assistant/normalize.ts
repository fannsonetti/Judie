const CONTRACTIONS: Record<string, string> = {
  "what's": "what is",
  "whats": "what is",
  "how's": "how is",
  "where's": "where is",
  "who's": "who is",
  "it's": "it is",
  "they're": "they are",
  "that's": "that is",
  "there's": "there is",
  "today's": "today",
  "i'm": "i am",
  "you're": "you are",
  "we're": "we are",
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "cannot",
  "won't": "will not",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "couldn't": "could not",
  "wouldn't": "would not",
  "shouldn't": "should not",
  "ain't": "is not",
  "aint": "is not",
  "let's": "let us",
  "lets": "let us",
  "gonna": "going to",
  "wanna": "want to",
  "kinda": "kind of",
  "yall": "you all",
  "y'all": "you all",
};

const WAKE_ONLY = /^(hey |hi |hello |yo |ok |okay )?(nova)$/i;

export function isWakeOnly(raw: string): boolean {
  const t = raw
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[?!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return WAKE_ONLY.test(t);
}

export function normalizeUtterance(raw: string, keepCommas = false): string {
  let t = raw.toLowerCase().replace(/[“”]/g, '"').replace(/[’]/g, "'");
  t = t.replace(/^(hey |hi |hello |yo |ok |okay |ayo )?nova[,:]?\s+/i, "");
  t = stripFluff(t);
  for (const [k, v] of Object.entries(CONTRACTIONS)) {
    t = t.replace(new RegExp(`\\b${k}\\b`, "g"), v);
  }
  t = t.replace(/\b'?em\b/g, "them");
  t = t.replace(keepCommas ? /[?!.;:]+/g : /[?!.,;:]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  t = stripFluff(t);
  return t;
}

function stripFluff(text: string) {
  let t = text.replace(/\s+/g, " ").trim();
  const lead = [
    /^(ain'?t no (bot|ai|assistant|computer)\s+)/i,
    /^(is not no (bot|ai|assistant)\s+)/i,
    /^(no offense[, ]+)/i,
    /^(real talk[, ]+)/i,
    /^(ayo |hey |ok |okay |alright |um |uh |like )+/i,
  ];
  for (const re of lead) {
    if (re.test(t) && t.replace(re, "").trim().split(/\s+/).length >= 2) {
      t = t.replace(re, "").trim();
    }
  }
  // Keep bare greetings; only peel politeness when a request remains.
  const wrap = [
    /^(can you please|could you please|would you please|can you|could you|would you|please)\s+/i,
  ];
  for (const re of wrap) {
    const rest = t.replace(re, "").trim();
    if (rest && rest !== t && rest.split(/\s+/).length >= 2) t = rest;
  }
  if (/^(yo|hey|hi)$/i.test(t)) return t;
  t = t.replace(/^(yo|ayo)\s+/i, "");
  t = t.replace(/\b(could you|can you|would you)\s+/gi, "");
  return t.replace(/\s+/g, " ").trim();
}

const SPLIT_RE = /\s*(?:,|\band then\b|\bthen\b|\balso\b|\band\b)\s*/;

export function splitClauses(text: string): string[] {
  if (!text) return [];
  const parts = text.split(SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return [text];

  const merged: string[] = [];
  for (const part of parts) {
    if (part.split(" ").length < 2 && merged.length) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else {
      merged.push(part);
    }
  }
  return merged.length ? merged : [text];
}

export function hasAnaphora(text: string) {
  return /\b(it|them|those|that|this|em)\b/.test(text);
}
