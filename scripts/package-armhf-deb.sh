#!/usr/bin/env bash
# Package the native Slint Pi binary as an armhf .deb (no WebKitGTK).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/src-tauri"

VERSION="$(grep '^version' Cargo.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')"
ARCH="armhf"
PKG="Judie_${VERSION}_${ARCH}"
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
  "$STAGING/lib/systemd/system" \
  "$STAGING/etc/sudoers.d"

install -m755 "$BIN" "$STAGING/usr/bin/judie"
install -m755 "$ROOT/src-tauri/linux/apply-update" "$STAGING/usr/lib/judie/apply-update"
install -m755 "$ROOT/src-tauri/linux/wifi" "$STAGING/usr/lib/judie/wifi"
install -m755 "$ROOT/src-tauri/linux/power" "$STAGING/usr/lib/judie/power"
install -m755 "$ROOT/src-tauri/linux/kiosk" "$STAGING/usr/lib/judie/kiosk"
install -m755 "$ROOT/src-tauri/linux/xinitrc" "$STAGING/usr/lib/judie/xinitrc"
install -m755 "$ROOT/src-tauri/linux/wait-display" "$STAGING/usr/lib/judie/wait-display"
install -m644 "$ROOT/src-tauri/linux/Xwrapper.config" "$STAGING/usr/lib/judie/Xwrapper.config"
install -m644 "$ROOT/src-tauri/linux/10-noscreenblank.conf" "$STAGING/usr/lib/judie/10-noscreenblank.conf"
install -m644 "$ROOT/src-tauri/linux/20-pi-fbdev.conf" "$STAGING/usr/lib/judie/20-pi-fbdev.conf"
install -m644 "$ROOT/src-tauri/linux/20-pi-modeset.conf" "$STAGING/usr/lib/judie/20-pi-modeset.conf"
install -m644 "$ROOT/src-tauri/linux/judie.service" "$STAGING/lib/systemd/system/judie.service"
install -m440 "$ROOT/src-tauri/linux/sudoers-judie-update" "$STAGING/etc/sudoers.d/judie-update"
install -m644 "$ROOT/src-tauri/linux/judie.desktop" "$STAGING/usr/share/applications/judie.desktop"
install -m644 "$ROOT/src-tauri/icons/128x128.png" "$STAGING/usr/share/icons/hicolor/128x128/apps/judie.png"

cat >"$STAGING/DEBIAN/control" <<EOF
Package: judie
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: ${ARCH}
Depends: sudo, iw, wpasupplicant, xserver-xorg, xinit, x11-xserver-utils, xserver-xorg-input-libinput, xserver-xorg-video-fbdev, xdotool, fonts-dejavu-core, libx11-6, libx11-xcb1, libxcb1, libxkbcommon0, libxkbcommon-x11-0, libxcursor1, libxi6, libxrandr2, libfontconfig1, libfreetype6
Maintainer: Judie <judie@local>
Description: Judie room control (native Pi kiosk)
 Native Slint UI for Raspberry Pi — no WebKit process. Boots via systemd + bare Xorg.
EOF

cat >"$STAGING/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
chmod 755 /usr/lib/judie/apply-update /usr/lib/judie/wifi /usr/lib/judie/power /usr/lib/judie/kiosk /usr/lib/judie/xinitrc /usr/lib/judie/wait-display 2>/dev/null || true
chmod 440 /etc/sudoers.d/judie-update 2>/dev/null || true

KIOSK_USER=""
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  KIOSK_USER="$SUDO_USER"
elif getent passwd 1000 >/dev/null 2>&1; then
  KIOSK_USER="$(getent passwd 1000 | cut -d: -f1)"
fi

if [ -n "$KIOSK_USER" ]; then
  KIOSK_UID="$(id -u "$KIOSK_USER")"
  KIOSK_GROUP="$(id -gn "$KIOSK_USER")"
  KIOSK_HOME="$(getent passwd "$KIOSK_USER" | cut -d: -f6)"
  mkdir -p /etc/systemd/system/judie.service.d
  cat >/etc/systemd/system/judie.service.d/user.conf <<DROP
[Service]
User=${KIOSK_USER}
Group=${KIOSK_GROUP}
Environment=HOME=${KIOSK_HOME}
Environment=XDG_RUNTIME_DIR=/run/user/${KIOSK_UID}
DROP
  for grp in video input render; do
    if getent group "$grp" >/dev/null 2>&1; then
      usermod -aG "$grp" "$KIOSK_USER" 2>/dev/null || true
    fi
  done
fi

if [ -f /usr/lib/judie/Xwrapper.config ]; then
  cp /usr/lib/judie/Xwrapper.config /etc/X11/Xwrapper.config
fi
mkdir -p /etc/X11/xorg.conf.d
if [ -f /usr/lib/judie/10-noscreenblank.conf ]; then
  cp /usr/lib/judie/10-noscreenblank.conf /etc/X11/xorg.conf.d/10-noscreenblank.conf
fi
# fbdev needs /dev/fb0. This Pi often only has DRM (card0); modesetting then.
if [ -e /dev/fb0 ] && [ -f /usr/lib/judie/20-pi-fbdev.conf ]; then
  cp /usr/lib/judie/20-pi-fbdev.conf /etc/X11/xorg.conf.d/20-pi-fbdev.conf
  rm -f /etc/X11/xorg.conf.d/20-pi-modeset.conf
elif [ -f /usr/lib/judie/20-pi-modeset.conf ]; then
  cp /usr/lib/judie/20-pi-modeset.conf /etc/X11/xorg.conf.d/20-pi-modeset.conf
  rm -f /etc/X11/xorg.conf.d/20-pi-fbdev.conf
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi

if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  systemctl daemon-reload || true
  systemctl enable judie.service >/dev/null 2>&1 || true
  # Never start or restart here. The running kiosk stays on screen; reboot
  # happens only after the UI verifies the installed package version.
fi
EOF
chmod 755 "$STAGING/DEBIAN/postinst"

cat >"$STAGING/DEBIAN/prerm" <<'EOF'
#!/bin/sh
set -e
# Do not stop judie.service here. disable --now blanks tty1 (cursor on black)
# while uninstall is still running. The UI reboots after it verifies removal.
if [ "$1" = "remove" ] || [ "$1" = "deconfigure" ]; then
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl disable judie.service >/dev/null 2>&1 || true
  fi
fi
EOF
chmod 755 "$STAGING/DEBIAN/prerm"

cat >"$STAGING/DEBIAN/postrm" <<'EOF'
#!/bin/sh
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
  rm -rf /etc/systemd/system/judie.service.d
  if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
    systemctl daemon-reload || true
    # Do not start getty@tty1 here. judie.service Conflicts=getty@tty1, so
    # starting getty would stop the still-running kiosk and blank the screen.
    # After reboot, getty@tty1 starts as usual.
  fi
fi
EOF
chmod 755 "$STAGING/DEBIAN/postrm"

mkdir -p "$OUT"
dpkg-deb --root-owner-group -Zxz --build "$STAGING" "$OUT/${PKG}.deb"
echo "$OUT/${PKG}.deb"
