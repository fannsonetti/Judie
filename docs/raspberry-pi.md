# Judie on Raspberry Pi 3



Keep **32-bit Raspberry Pi OS** (Bookworm or Trixie, armhf). Do not switch to Ubuntu Desktop — it uses more RAM and is worse on a 1 GB Pi 3. Raspberry Pi OS already has the GPU drivers Judie needs.



32-bit userspace uses less RAM than 64-bit. On a 1 GB Pi 3 that matters.



Judie is meant to *look like* the tablet OS: fullscreen, no window title, starts after install. Target OS is **Raspberry Pi OS Lite 32-bit** (no desktop session).

## Pi builds use native Slint (not WebKit)

Linux **armhf** releases ship a **native Slint home screen** — weather, lights, media, calendar, climate, air, quick controls, system, timers, activity, and server, plus settings, command palette, and expanded apps. No WebKitWebProcess.

**Windows is unsupported beginning with v0.2.14.** Releases publish only the Raspberry Pi Debian package. There is no Windows installer, executable, or substitute client.

## Network (Raspberry Pi OS)

The Lite image already uses **NetworkManager**. Judie talks to it through `/usr/lib/judie/wifi` (`nmcli` terse APIs and a 0600 NetworkManager keyfile for new Wi-Fi secrets). It does not install another network manager. Wi-Fi passwords are never stored in Judie data, never logged, and never passed as helper command arguments.

## Physical Raspberry Pi checks

Automation covers widget fixtures, Settings layout, gesture physics, and mocked NetworkManager states. The following still need a real Pi + display + access point:

1. Open Settings → Network and confirm the current Ethernet or Wi-Fi row (type, iface, SSID, IPs, gateway, DNS, MAC, speed, internet vs local).
2. Refresh / rescan nearby Wi-Fi. Confirm scanning, empty, and error copy. The sheet must stay scrollable while a scan runs.
3. Join an open network and a WPA2 network. Enter a wrong password and confirm “Incorrect password.” without the secret appearing in `journalctl -u judie`.
4. Join a hidden SSID from “Join hidden network”.
5. Disconnect, reconnect, then Forget (confirm dialog) the current network. Reboot and confirm forgotten networks stay gone and user-created Settings still load.
6. Ethernet-only: unplug Wi-Fi / prefer Ethernet. Confirm the page says Ethernet, not internet, until NM connectivity is `full`.
7. Break gateway, DNS, and internet separately (bad default route, bad resolver, upstream down). Diagnostics must show independent Passed / Failed / Timed out rows.
8. Scroll a long Settings page from mid-content without closing. Swipe up from the bottom 28px edge and confirm the sheet follows the finger, then settles closed.
9. Power: Restart / Shut Down / Uninstall stay in one short row and still confirm. Software version switching still works.
10. Add-widget editor: Small / Medium / Large previews stay sharp at 1920×1200, keep 1:1 / 2:1 / 1:1, and match the widget that lands on the home grid.

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

Uninstall: Settings → Power → Uninstall. The panel warns what is removed (the Judie package and kiosk autostart) and what is kept (`~/.local/share/judie`). It does not stop the kiosk first. After the package is gone, the panel reboots to the normal login screen.

Or from a terminal: `sudo apt remove judie`.

## Updates

Settings → Power lists **stable** GitHub releases that ship a compatible `.deb` for this Pi. Drafts, prereleases, and packages for other architectures are omitted.

Tap **Check for updates** to refresh the list. The panel reports whether the installed package is already latest.

Restart, Shut Down, and Uninstall sit in one compact row. Each action asks for confirmation. Restart and Shut Down call `/usr/lib/judie/power` (`reboot` or `poweroff` only). Uninstall uses the same helper, then reboots after removal is verified. The helper never stops `judie.service`, so tty1 does not drop to a blank cursor. Failures stay on this screen with the real error.

Choose another version to upgrade or downgrade. A confirmation shows the current version, the target, and which direction this is. The current version cannot be selected again.

Judie stays on screen through **Downloading → Validating → Installing → Verifying → Rebooting**. The helper `/usr/lib/judie/apply-update` only installs a staged Judie `.deb` (no arbitrary root commands, and it does not stop the kiosk or reboot on its own). After `dpkg-query` confirms the package version, the UI reboots. A failed install leaves the previous package in place and does not reboot.

User data in `~/.local/share/judie` (layout, widgets, routines, settings) is not part of the package and is kept.

The first time you move off an older copy that still uses `pkexec`, install once from a terminal:

```bash
curl -fsSL -o /tmp/judie.deb https://github.com/fannsonetti/Judie/releases/latest/download/judie_armhf.deb
sudo apt install -y /tmp/judie.deb
```

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

## Leftover scripts (not used by Lite)

- `scripts/judie-autostart.desktop` — old PIXEL/LXDE autostart. The armhf package uses `judie.service`, not `/etc/xdg/autostart`.
- `scripts/patch-deb-depends.sh` — patches **Tauri GTK desktop** `.deb` Depends (`libgtk-3-0t64`). Do not run it on the Pi kiosk package.

Linux desktop developers can run the Slint kiosk UI with `./scripts/run-pi-ui.sh` (needs `DISPLAY` or Wayland). That is not how the Pi boots.

## Runtime tips for Pi 3

1. Use **32-bit Raspberry Pi OS Lite**
2. Install the armhf `.deb` and reboot — `judie.service` owns tty1
3. Debug from SSH: `sudo systemctl stop judie` then `DISPLAY=:0 judie`
4. Logs: `journalctl -u judie -b`
5. Crash recovery: systemd `Restart=always` (Judie or Xorg dying comes back in a few seconds)
6. If start is rate-limited: `sudo systemctl reset-failed judie && sudo systemctl start judie`

## CI

GitHub Actions cross-compiles the native Slint binary for **armhf** on `ubuntu-24.04-arm` when you push a `v*` tag (see `.github/workflows/release.yml`). The job creates the GitHub release and uploads `judie_armhf.deb`. No Windows job or artifacts are produced.

