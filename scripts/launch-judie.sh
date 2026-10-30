#!/usr/bin/env bash
# Open Judie without a terminal. Used by Judie.desktop on Raspberry Pi.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

find_app() {
  if command -v judie >/dev/null 2>&1; then
    command -v judie
    return 0
  fi
  if [[ -x /usr/bin/judie ]]; then
    echo /usr/bin/judie
    return 0
  fi
  if [[ -x "$HOME/.local/bin/judie" ]]; then
    echo "$HOME/.local/bin/judie"
    return 0
  fi
  if [[ -x "$ROOT/src-tauri/target/release/judie" ]]; then
    echo "$ROOT/src-tauri/target/release/judie"
    return 0
  fi
  local appimage
  appimage="$(ls -1t "$ROOT"/src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -n1 || true)"
  if [[ -n "$appimage" && -f "$appimage" ]]; then
    chmod +x "$appimage" 2>/dev/null || true
    echo "$appimage"
    return 0
  fi
  return 1
}

if ! APP="$(find_app)"; then
  MSG="Judie is not built or installed yet.

Double-click \"Build Judie\" on the Desktop first,
or in a terminal run:
  ./scripts/build-pi.sh"
  if command -v zenity >/dev/null 2>&1; then
    zenity --error --title="Judie" --width=420 --text="$MSG"
  elif command -v lxmessage >/dev/null 2>&1; then
    lxmessage -title Judie "$MSG"
  else
    printf '%s\n' "$MSG" >&2
  fi
  exit 1
fi

exec "$APP" "$@"
