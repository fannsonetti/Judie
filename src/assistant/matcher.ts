export interface IntentDef {
  name: string;
  domain: string;
  patterns: string[];
  keywords?: string[];
}

const OPTIONAL_RE = /\(([^)]+)\)/g;
const ALT_RE = /\{([^}]+)\}/g;
const WILD = "<<<WILD>>>";

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function altInner(inner: string) {
  return inner
    .split("|")
    .map((x) => escapeReg(x.trim()).replace(/\\ /g, "\\s+"))
    .join("|");
}

export function patternToRegex(pattern: string): RegExp {
  let p = pattern.trim().toLowerCase();
  p = p.replace(/\*/g, WILD);

  const chunks: string[] = [];
  const hold = (re: string) => {
    const i = chunks.length;
    chunks.push(re);
    return `@@${i}@@`;
  };

  p = p.replace(ALT_RE, (_m, inner: string) => {
    const parts = inner.split("|").map((x) => `\\b${escapeReg(x.trim())}\\b`);
    return hold(`(?:${parts.join("|")})`);
  });

  p = p.replace(/\s+\(([^)]+)\)/g, (_m, inner: string) => hold(`(?:\\s+(?:${altInner(inner)}))?`));

  p = p.replace(OPTIONAL_RE, (_m, inner: string) => {
    if (/^@@\d+@@$/.test(inner) || inner.startsWith("?:")) return _m;
    return hold(`(?:(?:${altInner(inner)})\\s+)?`);
  });

  p = p.replace(/\s+/g, "\\s+");
  p = p.replace(new RegExp(WILD, "g"), ".*?");
  p = p.replace(/@@(\d+)@@/g, (_m, n: string) => chunks[Number(n)]);
  return new RegExp(`^(?:${p})$`, "i");
}

const compiled = new Map<string, { pattern: string; re: RegExp }[]>();

function compile(intents: IntentDef[]) {
  compiled.clear();
  for (const intent of intents) {
    compiled.set(
      intent.name,
      intent.patterns.map((pattern) => {
        try {
          return { pattern, re: patternToRegex(pattern) };
        } catch {
          return { pattern, re: new RegExp(`^${escapeReg(pattern)}$`, "i") };
        }
      })
    );
  }
}

export interface MatchCandidate {
  name: string;
  domain: string;
  confidence: number;
  pattern?: string;
  source: "pattern" | "keyword" | "frame";
}

/** Pattern matches can execute. Keyword hits are ranking-only and stay below this. */
export const KEYWORD_CAP = 0.49;
export const PATTERN_MIN = 0.86;

function patternConfidence(pattern: string) {
  if (pattern.includes("*")) return 0.86;
  if (/\(.*\)|\{.*\}/.test(pattern)) return 0.9;
  return 0.94;
}

export function matchAll(text: string, intents: IntentDef[]): MatchCandidate[] {
  if (!compiled.size) compile(intents);
  const out: MatchCandidate[] = [];

  for (const intent of intents) {
    const list = compiled.get(intent.name) ?? [];
    for (const { pattern, re } of list) {
      if (re.test(text)) {
        out.push({
          name: intent.name,
          domain: intent.domain,
          confidence: patternConfidence(pattern),
          pattern,
          source: "pattern",
        });
        break;
      }
    }
  }

  for (const intent of intents) {
    if (!intent.keywords?.length) continue;
    const hits = intent.keywords.filter((k) => {
      if (k.length < 4) return new RegExp(`\\b${k}\\b`).test(text);
      return text.includes(k);
    }).length;
    if (!hits) continue;
    out.push({
      name: intent.name,
      domain: intent.domain,
      confidence: Math.min(KEYWORD_CAP, 0.32 + hits * 0.08),
      source: "keyword",
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}

export function matchIntent(
  text: string,
  intents: IntentDef[]
): MatchCandidate | null {
  const all = matchAll(text, intents);
  const patterned = all.find((c) => c.source === "pattern" && c.confidence >= PATTERN_MIN);
  return patterned ?? null;
}

export function resetMatcher(intents: IntentDef[]) {
  compile(intents);
}
