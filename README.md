# Judie

Tablet-style room control for a 1920×1200 display (also runs on Raspberry Pi). Tauri + React + TypeScript.

Judie is a local environment assistant, not a chatbot. Commands are parsed deterministically — no LLM is required.

## Run

```bash
npm install
npm run dev          # Vite only
npm run tauri dev    # desktop app
npm test
```

## Installers

| Platform | How |
| --- | --- |
| Windows x64 | Double-click `build.bat` (or `npm run installer`) |
| Raspberry Pi 3+ (64-bit OS) | On the Pi: `./scripts/build-pi.sh` — see [docs/raspberry-pi.md](docs/raspberry-pi.md) |

`build-pi.bat` on Windows only prints instructions; the Pi `.deb` must be built on Linux aarch64.

## What it does

- Home screen of live widgets (long-press to edit, extra pages only if you add them)
- Lights, scenes, media, purifier, climate, calendar, weather, timers, activity
- Natural-language commands via swipe-down from the top (or **Ctrl+K**)
- Configurable routines (Good Night, Movie, Away, plus “when I say …”)
- Timers, alarms, delayed actions (`turn the lights off in 20 minutes`)
- Undo (say “undo” or Ctrl+Z)
- Real weather from [Open-Meteo](https://open-meteo.com) (no API key)
- Activity log with source (manual / Judie / routine / timer)

## Commands (examples)

Speak or type variations — wording does not need to be exact:

- “lights off” / “kill the lights” / “make it dark in here”
- “turn the desk lamp on”
- “make them darker” (after talking about lights)
- “what’s the temperature outside?” → “what about tomorrow?”
- “turn off the lights, set my alarm for 7 and tell me tomorrow’s weather”
- “when I say focus mode, turn the ceiling light off and set volume to 20”

Swipe down from the top of the screen (iPad-style) for search, listen, and settings. Space starts/stops listening when you are not typing. Escape cancels overlays and speech.

## Settings

Swipe down → **Settings**:

- Room name and weather location (lat/lon)
- Voice in / voice out
- Units
- Proactive notices (timers, calendar, rain, air, device issues)
- Custom routines

Indoor climate and the music queue are **local to this tablet** until a sensor or player is connected. That is intentional — the UI does not pretend to be wired to hardware that is not there.

Optional: if the Python [Nova Assistant](../Nova%20Assistant) is running on `127.0.0.1:8742`, the Server widget can show it as online (TCP check from the Tauri backend). This tablet still owns room state.

## Custom widgets

Design them in Judie: edit mode → add widget → **Open Widget Creator…**, then **Save to Judie**. Format spec: [docs/widget-format.md](docs/widget-format.md). You can still import a `.judie-widget.json` file from the gallery.

## Architecture

```
UI widgets  →  room store (persisted)
Typed/spoken text → normalize → intent match → actions → room store → spoken reply
Timers / routines / weather fetch run beside the UI
```

Adding a capability: handle it in `src/assistant/intents.ts` + `process.ts`, then apply a `RoomAction` in `src/store/roomStore.ts`.

Debug overlay in development: **Ctrl+Shift+D** (intent, actions, timing — no hidden model reasoning; there isn’t one).

Conversation text is appended to a log file (not just the browser):

`%AppData%\com.judie.app\logs\conversation.log`

Open it from Settings. There is also `conversation.jsonl` beside it.
