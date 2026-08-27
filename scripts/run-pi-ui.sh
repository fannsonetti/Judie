#!/usr/bin/env bash
# Run the native Slint kiosk UI (judie-pi) on a Linux desktop for development.
# Not used on the Pi appliance — that boots via systemd + xinit.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "run-pi-ui.sh is for Linux desktops. On Windows use the Tauri UI; on the Pi use judie.service." >&2
  exit 1
fi

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" && -z "${WAYLAND_SOCKET:-}" ]]; then
  echo "Need DISPLAY or WAYLAND_DISPLAY (open a graphical session first)." >&2
  exit 1
fi

if ! command -v rustc >/dev/null; then
  echo "Install Rust first: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" >&2
  exit 1
fi

# CI sysroot config is only for the armv7 target; native desktop builds must not use it.
if [[ ! -d /opt/armhf && -f "$ROOT/.cargo/config.toml" ]]; then
  echo "==> ignoring .cargo/config.toml (no CI sysroot)"
  mv "$ROOT/.cargo/config.toml" "$ROOT/.cargo/config.toml.ci-sysroot"
  restore_cargo_config() { mv "$ROOT/.cargo/config.toml.ci-sysroot" "$ROOT/.cargo/config.toml" 2>/dev/null || true; }
  trap restore_cargo_config EXIT
fi

exec cargo run --manifest-path src-tauri/Cargo.toml --release \
  --no-default-features --features pi-native --bin judie-pi "$@"
