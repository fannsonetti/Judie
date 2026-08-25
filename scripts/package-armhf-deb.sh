#!/usr/bin/env bash
# Package the native Slint Pi binary as an armhf .deb (no WebKitGTK).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src-tauri"

VERSION="$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')"
ARCH="armhf"
PKG="judie_${VERSION}_${ARCH}"
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT

TARGET="${CARGO_TARGET:-}"
if [[ -n "$TARGET" && -f "$ROOT/src-tauri/target/${TARGET}/release/judie-pi" ]]; then
  BIN="$ROOT/src-tauri/target/${TARGET}/release/judie-pi"
  OUT="$ROOT/src-tauri/target/${TARGET}/release/bundle/deb"
elif [[ -f "$ROOT/src-tauri/target/release/judie-pi" ]]; then
  BIN="$ROOT/src-tauri/target/release/judie-pi"
  OUT="$ROOT/src-tauri/target/release/bundle/deb"
else
  echo "judie-pi binary not found (build with --features pi-native)" >&2
  exit 1
fi

mkdir -p \
  "$STAGING/DEBIAN" \
  "$STAGING/usr/bin" \
  "$STAGING/usr/lib/judie" \
  "$STAGING/usr/share/applications" \
  "$STAGING/usr/share/icons/hicolor/128x128/apps" \
  "$STAGING/etc/xdg/autostart" \
  "$STAGING/etc/sudoers.d"

install -m755 "$BIN" "$STAGING/usr/bin/judie"
install -m755 "$ROOT/src-tauri/linux/apply-update" "$STAGING/usr/lib/judie/apply-update"
install -m440 "$ROOT/src-tauri/linux/sudoers-judie-update" "$STAGING/etc/sudoers.d/judie-update"
install -m644 "$ROOT/src-tauri/linux/judie.desktop" "$STAGING/etc/xdg/autostart/judie.desktop"
install -m644 "$ROOT/src-tauri/linux/judie.desktop" "$STAGING/usr/share/applications/judie.desktop"
install -m644 "$ROOT/src-tauri/icons/128x128.png" "$STAGING/usr/share/icons/hicolor/128x128/apps/judie.png"

cat >"$STAGING/DEBIAN/control" <<EOF
Package: judie
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: sudo, libx11-6, libxcb1, libxkbcommon0, libfontconfig1, libfreetype6
Maintainer: Judie <judie@local>
Description: Judie room control (native Pi kiosk)
 Native Slint UI for Raspberry Pi — no WebKit process.
EOF

cat >"$STAGING/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
chmod 755 /usr/lib/judie/apply-update 2>/dev/null || true
chmod 440 /etc/sudoers.d/judie-update 2>/dev/null || true
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi
EOF
chmod 755 "$STAGING/DEBIAN/postinst"

mkdir -p "$OUT"
dpkg-deb -Zxz --build "$STAGING" "$OUT/${PKG}.deb"
echo "$OUT/${PKG}.deb"
