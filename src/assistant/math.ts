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
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

const BLOCK = /\b(timer|alarm|lights?|volume|weather|forecast|purifier|scene)\b/;
const MATH_HINT =
  /\b(plus|minus|times|multiplied|divided?|divide|squared|cubed|root|percent of|calculate|compute|half of|power of)\b|[+\-*/×÷^()]|\d+\s*%|\d\s*[xX×]\s*\d/;

export function looksLikeMath(text: string) {
  const t = stripMathWrappers(text.trim().toLowerCase());
  if (!t || (BLOCK.test(t) && !/\d/.test(t))) return false;
  if (MATH_HINT.test(t)) return true;
  if (/\b\d+(\.\d+)?\s*[xX×+\-*/^÷]\s*\d/.test(t)) return true;
  if (/\bhalf of\b/.test(t) || /\bto the power of\b/.test(t)) return true;
  return /\b\d+(\.\d+)?\s*[+\-*/^]\s*\d/.test(t);
}

function stripMathWrappers(text: string) {
  let t = text.toLowerCase();
  for (let i = 0; i < 6; i++) {
    const next = t
      .replace(/^(can you|could you|please|tell me|what is|whats|what|how much is|calculate|compute|solve|work out)\s+/i, "")
      .replace(/\s+(please|again|equals|is)$/i, "")
      .trim();
    if (next === t) break;
    t = next;
  }
  return t;
}

function replaceWords(text: string) {
  let t = stripMathWrappers(text);
  t = t.replace(/\bequals?\b/g, " ");
  t = t.replace(/\bmultiplied by\b/g, "*");
  t = t.replace(/\bdivided by\b/g, "/");
  t = t.replace(/\bdivide[d]?\s+(\d+(?:\.\d+)?)\s+by\s+(\d+(?:\.\d+)?)/g, "$1/$2");
  t = t.replace(/\btimes\b/g, "*");
  t = t.replace(/\bplus\b/g, "+");
  t = t.replace(/\bminus\b/g, "-");
  t = t.replace(/\bover\b/g, "/");
  t = t.replace(/\bto the power of\b/g, "^");
  t = t.replace(/\bsquared\b/g, "^2");
  t = t.replace(/\bcubed\b/g, "^3");
  t = t.replace(/×/g, "*").replace(/÷/g, "/");
  t = t.replace(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/g, "$1*$2");
  t = t.replace(/\bhalf of\s+(\d+(?:\.\d+)?)/g, "($1/2)");
  t = t.replace(
    /(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+(\d+(?:\.\d+)?)/g,
    "(($1/100)*$2)"
  );
  t = t.replace(/(?:the\s+)?square\s+root\s+of\s+(\d+(?:\.\d+)?)/g, "($1^0.5)");
  t = t.replace(/(?:the\s+)?cube\s+root\s+of\s+(\d+(?:\.\d+)?)/g, "($1^(1/3))");
  const keys = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length);
  for (const w of keys) {
    t = t.replace(new RegExp(`\\b${w}\\b`, "g"), String(NUMBER_WORDS[w]));
  }
  return t.replace(/\s+/g, " ").trim();
}

type Tok = { kind: "num" | "op" | "lp" | "rp"; v: string | number };

function tokenize(expr: string): Tok[] | null {
  const tokens: Tok[] = [];
  let i = 0;
  const s = expr.replace(/\s+/g, "");
  while (i < s.length) {
    const c = s[i];
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const n = Number(s.slice(i, j));
      if (!Number.isFinite(n)) return null;
      tokens.push({ kind: "num", v: n });
      i = j;
      continue;
    }
    if ("+-*/^%".includes(c)) {
      tokens.push({ kind: "op", v: c });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "lp", v: c });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rp", v: c });
      i++;
      continue;
    }
    return null;
  }
  return tokens;
}

function parseExpr(tokens: Tok[]): number | null {
  let i = 0;
  const peek = () => tokens[i];
  const eat = () => tokens[i++];

  function parsePrimary(): number | null {
    const t = peek();
    if (!t) return null;
    if (t.kind === "num") {
      eat();
      return t.v as number;
    }
    if (t.kind === "op" && t.v === "-") {
      eat();
      const v = parsePrimary();
      return v == null ? null : -v;
    }
    if (t.kind === "lp") {
      eat();
      const v = parseAdd();
      if (!peek() || peek().kind !== "rp") return null;
      eat();
      return v;
    }
    return null;
  }

  function parsePow(): number | null {
    let left = parsePrimary();
    if (left == null) return null;
    while (peek()?.kind === "op" && peek().v === "^") {
      eat();
      const right = parsePow();
      if (right == null || Math.abs(right) > 12 || Math.abs(left) > 1e6) return null;
      left = left ** right;
      if (!Number.isFinite(left)) return null;
    }
    return left;
  }

  function parseMul(): number | null {
    let left = parsePow();
    if (left == null) return null;
    while (peek()?.kind === "op" && "+-".indexOf(String(peek().v)) < 0 && peek().v !== "^") {
      const op = eat().v as string;
      const right = parsePow();
      if (right == null) return null;
      if ((op === "/" || op === "%") && right === 0) return null;
      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else if (op === "%") left %= right;
      if (!Number.isFinite(left)) return null;
    }
    return left;
  }

  function parseAdd(): number | null {
    let left = parseMul();
    if (left == null) return null;
    while (peek()?.kind === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = eat().v as string;
      const right = parseMul();
      if (right == null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const value = parseAdd();
  if (value == null || i !== tokens.length) return null;
  return value;
}

export function tryEvaluate(text: string, previous?: number): { value: number; expression: string } | null {
  const expr0 = replaceWords(text);
  const followUp = previous != null && /^[+\-*/^%]/.test(expr0.trim());
  if (!looksLikeMath(text) && !followUp) return null;
  if (BLOCK.test(text) && !/\d/.test(text)) return null;
  const expr = followUp ? `${previous}${expr0}` : expr0;
  const tokens = tokenize(expr);
  if (!tokens || !tokens.length) return null;
  const value = parseExpr(tokens);
  if (value == null || !Number.isFinite(value)) return null;
  return { value, expression: expr };
}

export function formatNumber(n: number) {
  if (Number.isInteger(n) && Math.abs(n) < 1e12) return String(n);
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}
