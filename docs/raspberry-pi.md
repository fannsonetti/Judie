# Judie on Raspberry Pi 3



Keep **32-bit Raspberry Pi OS** (Bookworm or Trixie, armhf). Do not switch to Ubuntu Desktop — it uses more RAM and is worse on a 1 GB Pi 3. Raspberry Pi OS already has the GPU drivers Judie needs.



32-bit userspace uses less RAM than 64-bit. On a 1 GB Pi 3 that matters.



Judie is meant to *look like* the tablet OS: fullscreen, no window title, starts after install. Target OS is **Raspberry Pi OS Lite 32-bit** (no desktop session).

## Pi builds use native Slint (not WebKit)

Linux **armhf** releases ship a **native Slint home screen** — weather, lights, media, calendar, climate, air, quick controls, system, timers, activity, and server, plus settings, command palette, and expanded apps. No WebKitWebProcess.

Windows still uses the full Tauri + web UI (including the custom widget creator).

## Requirements

- **32-bit Raspberry Pi OS Lite** (Bookworm or Trixie) — the GitHub `.deb` is `armhf`
- Pi 3 Model B / B+ (or newer Pi running 32-bit userspace)
- HDMI display; the kiosk binary sizes itself to the framebuffer (no window manager required)
- ~1 GB free disk for the release package; ~2 GB if you build on the Pi

A 64-bit OS will not install the `armhf` release package. Build on that machine with `./scripts/build-pi.sh` if you stay on 64-bit.

Do **not** enable desktop autologin or raise `gpu_mem` for this build — Judie uses the Slint software renderer on bare Xorg.

## Install from GitHub (recommended)

On the Pi (armhf):

```bash
curl -fsSL https://raw.githubusercontent.com/fannsonetti/Judie/main/scripts/install-pi.sh | bash
```

Or install a specific `.deb` (never pipe the download into `apt`):

```bash
curl -fsSL -o /tmp/judie.deb https://github.com/fannsonetti/Judie/releases/latest/download/judie_armhf.deb
sudo apt install -y /tmp/judie.deb
```

The package pulls the X server, `xinit`, fonts, and input stack. No GTK/WebKit. After install, until systemd kiosk is enabled:

```bash
startx /usr/bin/judie -- :0 vt1 -nolisten tcp -nocursor
```

Uninstall: `sudo apt remove judie`.

## Updates

On boot, Judie asks GitHub whether a newer release exists. If it does, a small **warning bar** appears — it does not download or ask for a password by itself.

Tap **Update** to install. Linux packages ship `/usr/lib/judie/apply-update` plus a sudoers rule so that step is silent. The first time you move off an older copy that still uses `pkexec`, install once from a terminal:

```bash
curl -fsSL -o /tmp/judie.deb https://github.com/fannsonetti/Judie/releases/latest/download/judie_armhf.deb
sudo apt install -y /tmp/judie.deb
```

After that, later versions apply from the bar with no prompt. On the kiosk, Judie then exits `0` so `Restart=always` starts the new binary; the updater does not `exec judie` a second time.

## Kiosk

Linux armhf packages start **fullscreen via systemd** (`judie.service` → xinit → bare Xorg on tty1). No desktop session, no window manager.

## Build on the Pi

```bash
sudo apt update
sudo apt install -y git curl build-essential pkg-config \
  libx11-dev libxcb1-dev libxkbcommon-dev libfontconfig1-dev libfreetype6-dev

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

cd ~/Judie
./scripts/build-pi.sh
sudo apt install -y ./src-tauri/target/release/bundle/deb/*.deb
sudo reboot
```

First build can take **20–45 minutes** on a Pi 3 (Rust + Slint, no npm/WebKit).

## Performance

Measured on a Pi 3B (920 MiB RAM, HDMI 1920×1200, Raspberry Pi OS Lite Trixie, Judie 0.2.4 kiosk):

| Metric | Value |
| --- | --- |
| Cold boot (`systemd-analyze`) | kernel 4.0 s + userspace 30.8 s = **34.8 s** |
| `judie.service` active | **~28 s** after kernel start (`systemd-analyze critical-chain`) |
| Judie RSS (idle) | **~33 MiB** |
| Xorg RSS (`-nocursor`) | **~86–87 MiB** |
| Memory available after UI up | **~670 MiB** of 920 MiB |
| CPU idle | **~99% idle**; Judie ~0–2%, Xorg ~0% |
| GPU split | `gpu_mem=76M` (stock); do **not** raise it for the software renderer |

The native Pi UI is a single process (no WebKitWebProcess) on the Slint software renderer. Xorg at ~86 MiB is near the 80 MiB heuristic in the migration plan; a LinuxKMS/direct-DRM spike was **not** taken.

## Runtime tips for Pi 3

1. Use **32-bit Raspberry Pi OS Lite**
2. Install the armhf `.deb` and reboot — `judie.service` owns tty1
3. Debug from SSH: `sudo systemctl stop judie` then `DISPLAY=:0 judie`
4. Logs: `journalctl -u judie -b`
5. Crash recovery: systemd `Restart=always` (Judie or Xorg dying comes back in a few seconds)
6. If start is rate-limited: `sudo systemctl reset-failed judie && sudo systemctl start judie`

## CI

GitHub Actions cross-compiles the native Slint binary for **armhf** on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`). The job also uploads a stable `judie_armhf.deb` alias.

