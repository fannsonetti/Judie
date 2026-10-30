# Judie pixel UI: design direction

Status: approved direction (2026-10-30). Reference mockup: [pixel-ui-mockup.html](pixel-ui-mockup.html), which you can open in a browser. Background and roadmap: [../audit/2026-10-30-architecture-audit.md](../audit/2026-10-30-architecture-audit.md) §9.

## Why pixel style

The Pi 3B renders on the CPU (Slint `renderer-software`) at 1920×1200. A pixel style uses flat fills, hard edges, no blur, no gradients and no rounded corners, which is close to the cheapest thing that renderer can draw. Stepped motion at 10–15 fps reads as part of the style, so the panel doesn't have to hold 60 fps to feel finished. "Apple quality" here means consistency and polish, not glass effects. The reference point is the Playdate.

## Rules

1. **Grid.** Everything sits on a 4px base unit (2 art-pixels at Quality, 1 at Performance). No fractional offsets.
2. **Shapes.** Rectangles only. `border-radius: 0` everywhere. Borders are 3px solid, with no shadows, gradients, blur or transparency stacks.
3. **Colour.** Eight tokens per theme, no other colours on screen (except the selected theme's own values):

   | Token | Role | Dusk | Amber CRT | Pocket | Paper |
   |---|---|---|---|---|---|
   | `bg` | canvas | `#15121f` | `#0f0a02` | `#0f380f` | `#efe8d8` |
   | `panel` | tile fill | `#211c30` | `#1c1305` | `#1f4f1f` | `#fbf7ee` |
   | `line` | borders, empty segments | `#3b3354` | `#4a3208` | `#306230` | `#2b2620` |
   | `text` | primary text, PiMark | `#f3ecda` | `#ffcf7a` | `#c8e07a` | `#1e1a16` |
   | `dim` | labels, secondary | `#9d93b5` | `#b07d2a` | `#8bac0f` | `#6b6257` |
   | `accent1` | clock, active, selected, done chips | `#ffb43a` | `#ffb000` | `#e0f8a0` | `#d9480f` |
   | `accent2` | assistant, cursor, primary action | `#5fe3cf` | `#ffd36b` | `#9bbc0f` | `#1c7c74` |
   | `accent3` | urgent (running timer, alerts) | `#ff5f8d` | `#ff7a1a` | `#e0f8a0` | `#c2255c` |

   Dusk is the default.
4. **Type.** Two faces:
   - Labels, clock and buttons use a blocky caps face (mockup: Silkscreen).
   - Body and chat text use a readable pixel face (mockup: Pixelify Sans). Not bundled yet. The only bundled face is `src-tauri/ui/pi/fonts/PressStart2P.ttf` (OFL), which fits the blocky caps role.

   Pick fonts with an OFL licence and bundle them. Render at integer multiples of the font's design size only.
5. **Icons.** 8×8 bitmaps drawn on a grid, scaled by whole numbers (2× inline, 4× in tiles). They're coloured with `text`, or `accent1` for "warm" things like sun and light.
6. **Motion.** Stepped, never eased. The cursor blinks with `steps(1)`, progress bars advance in segments, and screens cut or wipe in 2–3 frames. Touch feedback (pressed state) lands in the same frame as the touch.
7. **Bars.** Every level indicator (brightness, volume, media progress, boot) is a row of discrete segments: filled = `accent1`, empty = `line`. No smooth fills.

## Brand mark: PiMark

The lopsided π stays as Judie's mark. It's defined in code, not as an image (`PiMark` in `src-tauri/ui/pi/cards.slint:821`). It's five rectangles in a 160×120 box:

```
(6,18) 148×14    top bar
(6,18)  14×40    left hook
(144,18) 10×26   right hook (shorter)
(52,18)  22×92   left leg (thick, long)
(102,18) 12×76   right leg (thin, short)
```

Keep these numbers exactly. The asymmetry is the point. Fill it with the `text` token (currently hard-coded `#ffffff`). It's used on:

- the boot screen, large (192 px wide), above "Judie" and a segmented progress bar;
- the home header, top-left, about 40 px wide, before the room name;
- next to the assistant's replies, as Judie's avatar, about 36 px wide;
- the sidebar rail, where it already is.

## Screens

- **Boot.** PiMark, the "Judie" wordmark and a segmented progress bar. Shown instead of a black screen while the kiosk starts.
- **Home.** Header: PiMark plus room name, date, Wi-Fi and volume glyphs. A 4×2 tile grid:
  - clock tile, 2 wide, `accent1`, with the next event under it;
  - weather, lights (segmented brightness) and now-playing tiles;
  - "Ask Judie" tile, 2 wide, with a typed prompt and blinking cursor;
  - timers tile.
- **Assistant.** User messages on the right (`line` fill). Judie's replies on the left in `panel` tiles, with the PiMark avatar, streaming character by character with a block cursor. Actions Judie took appear as chips above the reply (for example "Lights 30% · done", "Reminder 20:00 · set", plus "Undo"). The input bar has "Type or hold to talk" and a Send button.
- **Settings → Display.**
  - Quality: Performance / Quality.
  - Theme: Dusk / Amber CRT / Pocket / Paper.
  - Reduced motion: on / off.

## Quality settings

Keep it to two tiers plus Reduced motion. More tiers multiply design and test work.

| | Performance (default on Pi 3B) | Quality |
|---|---|---|
| Resolution | half (960×600, existing `display_scale == 50`) | native |
| Motion | stepped, about 12 fps, no screen transitions | 30 fps transitions, cross-fades between screens |
| Reduced motion | cuts all animation except touch feedback | same |

Before relying on half resolution, check on the real panel that its upscaler gives crisp pixels (nearest-neighbour), not blur. That's unverified.

## Implementation notes (Slint)

- `Dy` in `cards.slint:135` is already the token global. Make its colours `in-out` and set all eight from the active theme in one place. Persist the theme in `layout.json` alongside the other settings.
- `PiMark` gets `in property <color> fill: Dy.text`.
- **Font file (resolved):** the bundled `PixeloidSans.ttf` was actually Press Start 2P (see its name table), so the blocky-font toggle always worked. It is now named `fonts/PressStart2P.ttf`.
- Don't rebuild models every second while doing this. See audit findings H3/H4. The redesign shouldn't make `push_ui` heavier.
