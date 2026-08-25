# Judie on Raspberry Pi 3



Keep **32-bit Raspberry Pi OS** (Bookworm or Trixie, armhf). Do not switch to Ubuntu Desktop — it uses more RAM and is worse on a 1 GB Pi 3. Raspberry Pi OS already has the GPU drivers Judie needs.



32-bit userspace uses less RAM than 64-bit. On a 1 GB Pi 3 that matters.



Judie is meant to *look like* the tablet OS: fullscreen, no window title, auto-starts at login. It is still an app on Raspberry Pi OS, not a custom operating system.



## Pi builds use native Slint (not WebKit)



Linux **armhf** releases ship a **native Slint kiosk** — no WebKitWebProcess, no React shell. That keeps RAM use low and avoids the WebKit compositor stalls that made the old UI feel sluggish on Pi 3.



Windows builds still use the full Tauri + web UI. Pi parity for widgets/settings will land incrementally in the Slint UI.



## Requirements



- **32-bit Raspberry Pi OS** (Bookworm or Trixie) — the GitHub `.deb` is `armhf`

- Pi 3 Model B / B+ (or newer Pi running 32-bit userspace)

- Display: any HDMI panel; UI scales. Linux window is fullscreen (no title bar / panel chrome)

- ~1 GB free disk for the release package; ~2 GB if you build on the Pi



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

curl -LO https://github.com/fannsonetti/Judie/releases/download/v0.1.2/Judie_0.1.2_armhf.deb

sudo apt install -y ./Judie_0.1.2_armhf.deb

```



On **Trixie**, the package depends on normal X11/font libraries only (`libx11-6`, etc.) — not `libgtk-3-0`.



The `.deb` registers **one** autostart entry. After auto-login, Judie should open a single window.



To start it once from a terminal: `judie`.



Uninstall: `sudo apt remove judie`.



## Updates

On boot, Judie asks GitHub whether a newer release exists. If it does, a small **warning bar** appears — it does not download or ask for a password by itself.

Tap **Update** to install. Linux packages ship `/usr/lib/judie/apply-update` plus a sudoers rule so that step is silent. The first time you move off an older copy that still uses `pkexec`, install once from a terminal:

```bash
curl -LO https://github.com/fannsonetti/Judie/releases/download/v0.1.2/Judie_0.1.2_armhf.deb
sudo apt install -y ./Judie_0.1.2_armhf.deb
```

After that, later versions apply from the bar with no prompt.

## Kiosk



Linux builds start **fullscreen with window decorations off**.



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

```



First build can take **20–45 minutes** on a Pi 3 (Rust + Slint, no npm/WebKit).



## Performance



The native Pi UI is a single process. You should **not** see a separate WebKitWebProcess anymore.



Keep GPU memory at **128** in raspi-config. Prefer 1280×720 / 1280×800 if the panel allows it.



## Runtime tips for Pi 3



1. Use **32-bit** Raspberry Pi OS

2. Enable desktop **auto-login**

3. Do not run a browser beside Judie

4. Prefer 1280×720 / 1280×800 if 1920×1200 feels heavy



## CI



GitHub Actions cross-compiles the native Slint binary for **armhf** on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`).

