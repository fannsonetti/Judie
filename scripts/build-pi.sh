#!/usr/bin/env bash
# Build Judie for Raspberry Pi (run this ON the Pi).
# Pi 3 (1 GB): 32-bit Raspberry Pi OS (armhf / armv7). 64-bit OS still builds if that's what's installed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ARCH="$(uname -m)"
case "$ARCH" in
  armv7l|armhf|armv6l)
    echo "==> Native 32-bit ARM (${ARCH})"
    ;;
  aarch64|arm64)
    echo "==> Native 64-bit ARM (${ARCH})"
    echo "    Pi 3 with 1 GB RAM: 32-bit Raspberry Pi OS uses less memory. Rebuild there for armhf."
    ;;
  *)
    echo "Unexpected arch: $ARCH (need armv7l / armhf, or aarch64)."
    exit 1
    ;;
esac

if ! command -v rustc >/dev/null; then
  echo "Install Rust first: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

# CI cross-compile config points the linker at /opt/armhf. Native Pi builds use
# the same rustc target triple, so that sysroot would break the link.
if [[ ! -d /opt/armhf && -f "$ROOT/.cargo/config.toml" ]]; then
  echo "==> Native build: ignoring .cargo/config.toml (no CI sysroot)"
  mv "$ROOT/.cargo/config.toml" "$ROOT/.cargo/config.toml.ci-sysroot"
  restore_cargo_config() { mv "$ROOT/.cargo/config.toml.ci-sysroot" "$ROOT/.cargo/config.toml" 2>/dev/null || true; }
  trap restore_cargo_config EXIT
fi

echo "==> System packages (Slint / X11 — no WebKitGTK)"
if command -v apt-get >/dev/null; then
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    build-essential curl pkg-config \
    libx11-dev libxcb1-dev libxkbcommon-dev libfontconfig1-dev libfreetype6-dev
fi

export CARGO_PROFILE_RELEASE_LTO=true
export CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1
export CARGO_PROFILE_RELEASE_OPT_LEVEL=s
export CARGO_PROFILE_RELEASE_STRIP=symbols

echo "==> cargo build (native Slint kiosk)"
cargo build --release --manifest-path src-tauri/Cargo.toml --no-default-features --features pi-native --bin judie-pi

echo "==> package .deb"
bash scripts/package-armhf-deb.sh

DEB="$(find src-tauri/target -path '*/release/bundle/deb/*.deb' 2>/dev/null | head -n1 || true)"

echo
echo "Build complete."
[[ -n "$DEB" ]] && echo "  deb: $ROOT/$DEB"
echo
echo "Install:  sudo apt install -y ./$(basename "${DEB:-judie.deb}")"
echo "Run:      judie"
