# Judie on Raspberry Pi 3

Keep **64-bit Raspberry Pi OS** (Bookworm). Do not switch to Ubuntu Desktop — it uses more RAM and is worse on a 1 GB Pi 3. Raspberry Pi OS already has the GPU drivers Judie needs.

Judie is meant to *look like* the tablet OS: fullscreen, no window title, auto-starts at login. It is still an app on Raspberry Pi OS, not a custom operating system.

## Requirements

- **64-bit Raspberry Pi OS** (Bookworm) — 32-bit is not supported for Tauri/WebKitGTK
- Pi 3 Model B / B+ (or newer Pi)
- Display: any HDMI panel; UI scales. Linux window is fullscreen (no title bar / panel chrome)
- ~2 GB free disk if you build on the Pi

Optional on Pi 3:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Desktop autologin
# Performance → GPU Memory → 128
```

Reboot after that. Close Chromium and other heavy apps.

## Install from GitHub (recommended)

```bash
curl -LO https://github.com/fannsonetti/Judie/releases/latest/download/Judie_0.1.6_arm64.deb
sudo apt install -y ./Judie_0.1.6_arm64.deb
```

The `.deb` registers **autostart**. After auto-login, Judie should open by itself — you should not need to type `judie`.

To start it once from a terminal: `judie`.

Uninstall: `sudo apt remove judie`.

## Kiosk

Linux builds run **fullscreen with window decorations off**, so you should not see the Raspberry Pi top bar or the app name.

If the panel still peeks through once, click the Judie window or press F11-style fullscreen is already forced on launch. Auto-login + autostart is enough; you do not need to replace the OS.

## Updates

When a signed GitHub update is available, Judie shows a **black screen with a spinner**, installs, then relaunches. Unsigned releases cannot auto-update yet — install the new `.deb` by hand.

## Build on the Pi

```bash
sudo apt update
sudo apt install -y git curl

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

cd ~/Judie
./scripts/build-pi.sh
sudo apt install -y ./src-tauri/target/release/bundle/deb/*.deb
```

First build can take **30–90 minutes** on a Pi 3.

## Performance

The home screen is **one page** by default (extra pages only if you add widgets in edit mode). Off-screen pages are not kept mounted.

The tiny `judie` process in the task manager is only the GTK window. Painting runs in **WebKitWebProcess** — if Judie feels slow while CPU and RAM look idle, that is the compositor, not a missing blur toggle.

On a Raspberry Pi, Judie paints on the CPU instead of waiting on VideoCore DMA-BUF. Looks stay the same. Keep GPU memory at **128** in raspi-config.

## Runtime tips for Pi 3

1. Use **64-bit** OS only
2. Enable desktop **auto-login**
3. Do not run a browser beside Judie
4. Prefer 1280×720 / 1280×800 if 1920×1200 feels heavy

## CI

GitHub Actions builds Linux aarch64 on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`).
