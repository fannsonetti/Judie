export function looksLikeSvg(text: string) {
  return /<svg[\s>]/i.test(text.trim());
}

export function sanitizeSvg(raw: string): string | null {
  const text = raw.trim();
  if (!looksLikeSvg(text)) return null;
  let s = text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    let a = attrs;
    if (!/\bwidth=/i.test(a)) a += ' width="100%"';
    if (!/\bheight=/i.test(a)) a += ' height="100%"';
    if (!/\bpreserveAspectRatio=/i.test(a)) a += ' preserveAspectRatio="xMidYMid meet"';
    return `<svg${a}>`;
  });
  return s;
}

export async function svgFromFile(file: File): Promise<string | null> {
  const isSvg =
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (!isSvg) return null;
  return sanitizeSvg(await file.text());
}
