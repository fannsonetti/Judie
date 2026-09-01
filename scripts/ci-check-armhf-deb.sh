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
for pkg in xserver-xorg xinit xserver-xorg-video-fbdev fonts-dejavu-core libx11-6 libfontconfig1; do
  echo "$depends" | grep -qw "$pkg" || { echo "FAIL: Depends missing $pkg" >&2; exit 1; }
done
echo "$depends" | grep -qw 'libwayland-client0' && { echo "FAIL: Wayland still in Depends" >&2; exit 1; }

mapfile -t entries < <(dpkg-deb -c "$DEB")
for line in "${entries[@]:0:30}"; do
  user_group="$(echo "$line" | awk '{print $2}')"
  path="$(echo "$line" | awk '{print $6}')"
  [[ "$path" == "./" ]] && continue
  if [[ "$user_group" != "root/root" ]]; then
    echo "FAIL: $path owned by $user_group (want root/root)" >&2
    exit 1
  fi
done

script="$(dpkg-deb --fsys-tarfile "$DEB" | tar -xO ./usr/lib/judie/apply-update)"
echo "$script" | grep -q 'systemctl stop judie' && {
  echo "FAIL: apply-update must not stop judie.service" >&2
  exit 1
}
echo "$script" | grep -Eq 'allow-downgrades|dpkg --force-confold' || {
  echo "FAIL: apply-update must allow downgrades" >&2
  exit 1
}
echo "$script" | grep -q 'dpkg-query' || {
  echo "FAIL: apply-update must verify the installed package" >&2
  exit 1
}

echo "armhf .deb metadata OK"
