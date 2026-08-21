# Judie on Raspberry Pi 3

Judie can run on a **Pi 3**, but that board only has **1 GB RAM** and a weak GPU. Build and install on the Pi itself (or any Linux **aarch64** machine). Windows `build.bat` only makes the Windows installer.

## Requirements

- **64-bit Raspberry Pi OS** (Bookworm) — 32-bit is not supported for Tauri/WebKitGTK
- Pi 3 Model B / B+ (or newer Pi)
- Display: any HDMI panel; UI scales. Default Linux window is 1280×800 maximized
- ~2 GB free disk for the build toolchain

Optional but recommended on Pi 3:

```bash
# Give the GPU a little more memory (reboot after)
sudo raspi-config
# Performance → GPU Memory → 128
```

Close Chromium and other heavy apps before launching Judie.

## Build on the Pi

```bash
sudo apt update
sudo apt install -y git curl

# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

cd ~/Judie   # or wherever you cloned the repo
chmod +x scripts/build-pi.sh
./scripts/build-pi.sh
```

Outputs:

- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`

First build can take **30–90 minutes** on a Pi 3. Later builds are faster.

## Install

```bash
sudo apt install -y ./src-tauri/target/release/bundle/deb/judie_*.deb
# or
chmod +x src-tauri/target/release/bundle/appimage/*.AppImage
./src-tauri/target/release/bundle/appimage/*.AppImage
```

## Autostart (desktop session)

Copy the desktop entry:

```bash
mkdir -p ~/.config/autostart
cp scripts/judie-autostart.desktop ~/.config/autostart/
# Edit Exec= if Judie is not on PATH
```

Or open **Raspberry Pi → Preferences → Desktop Session Settings** and add `judie`.

For a kiosk-style boot into Judie only, set the session to auto-login and use that autostart file.

## Performance mode

Judie auto-enables **Pi mode** on low-RAM / ARM Linux:

- Disables blur and heavy gradients
- Shortens motion (no spring animations)
- Lighter status polling

Override in **Settings → Room → Performance**: Auto / Desktop / Pi.

## Runtime tips for Pi 3

1. Use **64-bit** OS only  
2. Prefer **deb** install over AppImage (slightly less overhead)  
3. Keep Performance on **Pi** or **Auto**  
4. Avoid running a browser beside Judie  
5. Prefer 1280×720 / 1280×800 panels if the UI feels sluggish at 1920×1200  

## CI

GitHub Actions can build Linux aarch64 on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`).
