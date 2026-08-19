export function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[b.length];
}

export function similarity(a: string, b: string) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.88;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length);
}

export function bestMatch<T>(
  query: string,
  items: T[],
  getName: (item: T) => string | string[],
  threshold = 0.72
): T | undefined {
  let best: T | undefined;
  let score = threshold;
  for (const item of items) {
    const names = getName(item);
    const list = Array.isArray(names) ? names : [names];
    for (const name of list) {
      const s = similarity(query, name);
      if (s > score) {
        score = s;
        best = item;
      }
    }
  }
  return best;
}
