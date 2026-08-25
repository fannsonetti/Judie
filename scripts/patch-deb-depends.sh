#!/usr/bin/env bash
# Tauri always adds bare libgtk-3-0 to Debian packages. Trixie / Ubuntu 24.04+ only
# ship libgtk-3-0t64 after the time_t transition, so apt cannot satisfy the dep.
set -euo pipefail

patch_control() {
  local control="$1"
  python3 - "$control" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
lines = text.splitlines()
out = []
for line in lines:
    if not line.startswith("Depends:"):
        out.append(line)
        continue
    deps = line[len("Depends:") :].strip()
    parts = [p.strip() for p in deps.split(",") if p.strip()]
    cleaned = []
    for part in parts:
        if part in ("libgtk-3-0", "libgtk-3-0t64"):
            continue
        if "libgtk-3-0" in part and "libgtk-3-0t64" in part:
            cleaned.append(part)
            continue
        cleaned.append(part)
    alt = "libgtk-3-0t64 | libgtk-3-0"
    if alt not in cleaned:
        cleaned.insert(0, alt)
    out.append("Depends: " + ", ".join(cleaned))
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY
}

for deb in "$@"; do
  [[ -f "$deb" ]] || { echo "missing deb: $deb" >&2; exit 1; }
  tmp="$(mktemp -d)"
  dpkg-deb -R "$deb" "$tmp"
  patch_control "$tmp/DEBIAN/control"
  dpkg-deb -Zxz --build "$tmp" "$deb" >/dev/null
  rm -rf "$tmp"
  echo "patched $deb"
done
