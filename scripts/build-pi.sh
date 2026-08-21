#!/usr/bin/env bash
# Build Judie for Raspberry Pi (run this ON the Pi, or on Linux aarch64).
# Pi 3: use 64-bit Raspberry Pi OS (Bookworm) — 32-bit is not supported by Tauri/WebKitGTK well.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64) ;;
  armv7l|armhf)
    echo "Pi 3 32-bit OS is not supported for Tauri builds."
    echo "Flash 64-bit Raspberry Pi OS (Bookworm) and re-run."
    exit 1
    ;;
  *)
    echo "Unexpected arch: $ARCH (need aarch64 for Pi 3 / Pi 4 / Pi 5)."
    exit 1
    ;;
esac

if ! command -v npm >/dev/null; then
  echo "Install Node.js 22+ first (nodesource or nvm)."
  exit 1
fi

if ! command -v rustc >/dev/null; then
  echo "Install Rust first: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

echo "==> System packages (WebKitGTK / GTK)"
if command -v apt-get >/dev/null; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential curl wget file libxdo-dev \
    libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev \
    librsvg2-dev patchelf libssl-dev
fi

echo "==> npm ci"
npm ci

KEY="$ROOT/src-tauri/keys/nova.key"
if [[ -f "$KEY" ]]; then
  export CI=true
  export TAURI_SIGNING_PRIVATE_KEY="$(tr -d '\r\n' < "$KEY")"
  export TAURI_SIGNING_PRIVATE_KEY_PATH="$KEY"
  if [[ -f "$ROOT/src-tauri/keys/password" ]]; then
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(tr -d '\r\n' < "$ROOT/src-tauri/keys/password")"
  else
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
  fi
else
  echo "Note: no src-tauri/keys/nova.key — updater signatures will be skipped."
fi

# Smaller binary, less RAM at runtime on 1GB Pi 3
export CARGO_PROFILE_RELEASE_LTO=true
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1
export CARGO_PROFILE_RELEASE_OPT_LEVEL=s
export CARGO_PROFILE_RELEASE_STRIP=symbols

echo "==> tauri build (deb + AppImage)"
npx tauri build --config src-tauri/tauri.linux.conf.json

DEB="$(find src-tauri/target/release/bundle/deb -name '*.deb' 2>/dev/null | head -n1 || true)"
APPIMAGE="$(find src-tauri/target/release/bundle/appimage -name '*.AppImage' 2>/dev/null | head -n1 || true)"

echo
echo "Build complete."
[[ -n "$DEB" ]] && echo "  deb:      $ROOT/$DEB"
[[ -n "$APPIMAGE" ]] && echo "  AppImage: $ROOT/$APPIMAGE"
echo
echo "Install:  sudo apt install -y ./$(basename "${DEB:-judie.deb}")"
echo "Or run:   chmod +x \"$APPIMAGE\" && \"$APPIMAGE\""
