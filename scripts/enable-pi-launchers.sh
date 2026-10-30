#!/usr/bin/env bash
# Make Judie double-clickable on Raspberry Pi OS.
# Do NOT double-click .sh files — Pi opens those in the file manager / editor.
# Run this ONCE from Terminal, then use the Desktop icons.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Scripts copied from Windows often have CRLF; that breaks execution on Linux
for f in \
  "$ROOT/scripts/launch-judie.sh" \
  "$ROOT/scripts/build-pi.sh" \
  "$ROOT/scripts/enable-pi-launchers.sh"
do
  [[ -f "$f" ]] || continue
  sed -i 's/\r$//' "$f"
  chmod +x "$f"
done

ICON="$ROOT/src-tauri/icons/128x128.png"
[[ -f "$ICON" ]] || ICON=applications-system

LAUNCH="$ROOT/scripts/launch-judie.sh"
BUILD="$ROOT/scripts/build-pi.sh"

# Absolute paths + bash so double-click works without "execute .sh" file-manager quirks
cat > "$ROOT/Judie.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Judie
Comment=Open Judie room control
Exec=/bin/bash "$LAUNCH"
Path=$ROOT
Icon=$ICON
Terminal=false
Categories=Utility;
StartupNotify=true
EOF

cat > "$ROOT/Build Judie.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Build Judie
Comment=Build Judie for Raspberry Pi
Exec=/bin/bash -lc 'cd "$ROOT" && /bin/bash "$BUILD"; echo; echo Done. Press Enter to close.; read'
Path=$ROOT
Icon=$ICON
Terminal=true
Categories=Development;
StartupNotify=true
EOF

chmod +x "$ROOT/Judie.desktop" "$ROOT/Build Judie.desktop"

DESKTOP="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
if [[ ! -d "$DESKTOP" ]]; then
  DESKTOP="$HOME/Desktop"
  mkdir -p "$DESKTOP"
fi

cp -f "$ROOT/Judie.desktop" "$DESKTOP/Judie.desktop"
cp -f "$ROOT/Build Judie.desktop" "$DESKTOP/Build Judie.desktop"
chmod +x "$DESKTOP/Judie.desktop" "$DESKTOP/Build Judie.desktop"

if command -v gio >/dev/null 2>&1; then
  gio set "$DESKTOP/Judie.desktop" metadata::trusted true 2>/dev/null || true
  gio set "$DESKTOP/Build Judie.desktop" metadata::trusted true 2>/dev/null || true
fi

# PCManFM (Raspberry Pi OS): allow launching executables without asking every time
CONF="$HOME/.config/libfm/libfm.conf"
mkdir -p "$(dirname "$CONF")"
if [[ -f "$CONF" ]]; then
  if grep -q '^quick_exec=' "$CONF" 2>/dev/null; then
    sed -i 's/^quick_exec=.*/quick_exec=1/' "$CONF"
  else
    printf '\n[config]\nquick_exec=1\n' >> "$CONF"
  fi
else
  printf '[config]\nquick_exec=1\n' > "$CONF"
fi

echo
echo "Done. Do not double-click .sh files."
echo
echo "On your Desktop, double-click:"
echo "  • Build Judie   — compile (first time, slow)"
echo "  • Judie         — open the app after build"
echo
echo "If a dialog asks, choose \"Execute\" or \"Execute in Terminal\"."
echo
