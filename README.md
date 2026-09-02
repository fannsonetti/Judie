# Judie

Linux-only room control for Debian-based Raspberry Pi systems (1920×1200 kiosk). Native Slint UI, no WebKit.

**Windows is unsupported beginning with v0.2.14.** There is no Windows installer, executable, or substitute client.

Judie is a local environment assistant, not a chatbot. Commands are parsed deterministically — no LLM is required.

## Install (Raspberry Pi)

On a 32-bit Raspberry Pi OS Lite system:

```bash
curl -fsSL https://raw.githubusercontent.com/fannsonetti/Judie/main/scripts/install-pi.sh | bash
```

Details: [docs/raspberry-pi.md](docs/raspberry-pi.md).

## Run (Linux)

```bash
npm install
npm test
./scripts/run-pi-ui.sh    # Slint kiosk UI on a Linux desktop (needs DISPLAY or Wayland)
```

Pi packages are built on Linux ARM:

```bash
./scripts/build-pi.sh
```

## What it does

- Home screen of live widgets (long-press to edit, extra pages only if you add them)
- Lights, scenes, media, purifier, climate, calendar, weather, timers, activity
- Natural-language commands via swipe-down from the top
- Configurable routines (Good Night, Movie, Away, plus “when I say …”)
- Timers, alarms, delayed actions (`turn the lights off in 20 minutes`)
- Undo (say “undo”)
- Real weather from [Open-Meteo](https://open-meteo.com) (no API key)
- Activity log with source (manual / Judie / routine / timer)

Swipe down from the top of the screen (iPad-style) for search, listen, and settings.

## Settings

Swipe down → **Settings**:

- Room name and weather location (lat/lon)
- Voice in / voice out
- Units
- Custom routines (name, trigger, action, with save / cancel / duplicate / enable / delete)

Indoor climate and the music queue are **local to this tablet** until a sensor or player is connected. That is intentional — the UI does not pretend to be wired to hardware that is not there.

## Custom widgets

Design them in Judie: edit mode → add widget → **Open Widget Creator…**, then **Save to Judie**. Format spec: [docs/widget-format.md](docs/widget-format.md). You can still import a `.judie-widget.json` file from the gallery.

## Architecture

```
UI widgets  →  room store (persisted)
Typed/spoken text → normalize → intent match → actions → room store → spoken reply
Timers / routines / weather fetch run beside the UI
```

Adding a capability: handle it in `src/assistant/intents.ts` + `process.ts`, then apply a `RoomAction` in `src/store/roomStore.ts`. The Raspberry Pi kiosk uses the native Slint UI and `src-tauri/src/pi_room.rs`.
