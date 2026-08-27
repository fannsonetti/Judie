#!/usr/bin/env bash
# Guard Pi .deb metadata: X stack in Depends, no GTK, root-owned files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEB="${1:-}"
if [[ -z "$DEB" ]]; then
  shopt -s nullglob
  files=("$ROOT"/src-tauri/target/*/release/bundle/deb/*_armhf.deb
         "$ROOT"/src-tauri/target/release/bundle/deb/*_armhf.deb)
  if (( ${#files[@]} == 0 )); then
    echo "No armhf .deb found. Pass a path." >&2
    exit 1
  fi
  DEB="${files[0]}"
fi

if [[ ! -f "$DEB" ]]; then
  echo "Missing $DEB" >&2
  exit 1
fi

echo "Checking $(basename "$DEB")"
INFO="$(dpkg-deb -I "$DEB")"
echo "$INFO"

echo "$INFO" | grep -qi 'libgtk-3' && { echo "FAIL: GTK must not be in the Pi package" >&2; exit 1; }

depends="$(echo "$INFO" | awk -F': ' '/^ Depends:/{print $2}')"
for pkg in xserver-xorg xinit fonts-dejavu-core libx11-6 libfontconfig1; do
  echo "$depends" | grep -qw "$pkg" || { echo "FAIL: Depends missing $pkg" >&2; exit 1; }
done
echo "$depends" | grep -qw 'libwayland-client0' && { echo "FAIL: Wayland still in Depends" >&2; exit 1; }

mapfile -t entries < <(dpkg-deb -c "$DEB")
for line in "${entries[@]:0:30}"; do
  owner="$(echo "$line" | awk '{print $3}')"
  group="$(echo "$line" | awk '{print $4}')"
  path="$(echo "$line" | awk '{print $6}')"
  [[ "$path" == "./" ]] && continue
  if [[ "$owner" != "root" || "$group" != "root" ]]; then
    echo "FAIL: $path owned by $owner:$group (want root:root)" >&2
    exit 1
  fi
done

echo "armhf .deb metadata OK"
