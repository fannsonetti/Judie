# Judie on Raspberry Pi 3

Keep **32-bit Raspberry Pi OS** (Bookworm, armhf). Do not switch to Ubuntu Desktop — it uses more RAM and is worse on a 1 GB Pi 3. Raspberry Pi OS already has the GPU drivers Judie needs.

32-bit userspace uses less RAM than 64-bit for WebKit. On a 1 GB Pi 3 that is the difference between a stable kiosk and SD-card swap hitching.

Judie is meant to *look like* the tablet OS: fullscreen, no window title, auto-starts at login. It is still an app on Raspberry Pi OS, not a custom operating system.

## Requirements

- **32-bit Raspberry Pi OS** (Bookworm) — the GitHub `.deb` is `armhf`
- Pi 3 Model B / B+ (or newer Pi running 32-bit userspace)
- Display: any HDMI panel; UI scales. Linux window is fullscreen (no title bar / panel chrome)
- ~2 GB free disk if you build on the Pi

A 64-bit OS will not install the `armhf` release package. Build on that machine with `./scripts/build-pi.sh` if you stay on 64-bit.

Optional on Pi 3:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Desktop autologin
# Performance → GPU Memory → 128
```

Reboot after that. Close Chromium and other heavy apps.

## Install from GitHub (recommended)

```bash
curl -LO https://github.com/fannsonetti/Judie/releases/latest/download/Judie_0.1.0_armhf.deb
sudo apt install -y ./Judie_0.1.0_armhf.deb
```

The `.deb` registers **one** autostart entry. After auto-login, Judie should open a single window.

To start it once from a terminal: `judie`.

Uninstall from **Settings → Judie → Uninstall**, or `sudo apt remove judie`.

## Updates

Settings → **Judie** → **Change installation** lists GitHub releases for this computer. Unsigned releases cannot use the silent updater yet.

## Kiosk

Linux builds start **fullscreen with window decorations off**. Use **Settings → Judie → Unfullscreen** for a normal window; that choice is remembered.

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

The tiny `judie` process in the task manager is only the GTK window. Painting runs in **WebKitWebProcess** — if Judie feels slow while that 10 MB process looks idle, look at WebKitWebProcess, not `judie`.

On a Raspberry Pi, DMA-BUF is disabled (VideoCore stall) but GL compositing stays on. Looks stay the same; frosted-glass blur is skipped because it is CPU-expensive. Keep GPU memory at **128** in raspi-config.

## Runtime tips for Pi 3

1. Use **32-bit** Raspberry Pi OS
2. Enable desktop **auto-login**
3. Do not run a browser beside Judie
4. Prefer 1280×720 / 1280×800 if 1920×1200 feels heavy

## CI

GitHub Actions builds Linux **armhf** (32-bit) on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`).
