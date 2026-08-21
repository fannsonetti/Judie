# Judie widget file format

You can design widgets in Judie's built-in Widget Creator, or write a `.judie-widget.json` file by hand and import it.

In Judie: edit mode → add widget → **Open Widget Creator…** (or **Import widget file…**)

The editor is optional. Judie only needs a valid definition in the custom widget library (or a valid JSON file).

## File shape

```json
{
  "format": "judie-widget",
  "version": 1,
  "widget": { }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `format` | yes | `"judie-widget"`. Older `"nova-widget"` files still import. |
| `version` | no | Use `1`. |
| `widget` | yes | The widget definition below. |

You can also omit the wrapper and put the widget object at the top level, as long as it has `id` and `layouts`.

Suggested filename: `my-widget.judie-widget.json`.

## Widget

```json
{
  "id": "indoor-stat",
  "name": "Indoor",
  "sizes": ["1x1", "1x2"],
  "background": null,
  "layouts": {
    "1x1": [],
    "1x2": [],
    "2x2": []
  }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable unique string. Re-importing the same `id` replaces the previous widget. |
| `name` | yes | Shown in the gallery. |
| `layouts` | yes | One array of elements per size. |
| `sizes` | no | Judie ignores this for the gallery. A size is addable **only if that layout array has at least one element**. |
| `background` | no | CSS color for the widget face. Omit or `null` for the default Judie shell. |
| `accent` | no | Stored, not drawn by itself. Use `accent` on bars/gauges instead. |

### Sizes

Judie home grid sizes:

| Size | Grid | Typical inner face (1920×1200) |
| --- | --- | --- |
| `1x1` | 1 column × 1 row | ~288×288 px |
| `1x2` | 2 columns × 1 row | ~596×288 px |
| `2x2` | 2 columns × 2 rows | ~596×596 px |

Each size is independent. Drawing on `1x1` does not affect `2x2`. Leave a size as `[]` (or omit the key) if you do not want it on the home screen.

## Coordinates

Every element uses **percentages of that size’s inner face**, origin top-left:

- `x`, `y` — top-left of the element (0–100)
- `w`, `h` — width and height (0–100)
- `x + w` and `y + h` should stay ≤ 100

A label at the top-left of any size:

```json
{ "x": 8, "y": 8, "w": 84, "h": 12 }
```

Array order is paint order. Later elements draw on top.

## Elements

Every element needs:

```json
{
  "id": "temp",
  "kind": "metric",
  "x": 8,
  "y": 28,
  "w": 50,
  "h": 22
}
```

`id` must be unique **within that size**. `kind` is one of: `text`, `metric`, `icon`, `bar`, `gauge`, `button`, `chip`, `divider`, `box`.

### Shared fields

| Field | Type | Default | Used by |
| --- | --- | --- | --- |
| `text` | string | — | text, metric, gauge label, button, chip |
| `fontSize` | number (px at canonical size) | 13 | text, metric, gauge, button, chip |
| `fontWeight` | number | 500 text / 650 metric / 600 button | text, metric, button, chip |
| `letterSpacing` | number | `-1.2` on metric, else `0` | text, metric, button, chip |
| `color` | CSS color | `--text` (`#f4f5f7`) | text, metric, icon, gauge, button, chip |
| `opacity` | 0–1 | `1` | all |
| `align` | `left` \| `center` \| `right` | `left` | text, metric, button, chip |
| `valign` | `top` \| `middle` \| `bottom` | `middle` | text, metric, button, chip |
| `fill` | CSS color | see kind | bar track, button, chip, box, divider |
| `accent` | CSS color | `--accent` (`#2d7bff`) | bar fill, gauge |
| `radius` | number (px) | kind default | bar, button, chip, box, divider |
| `value` | 0–100 | `0` | bar, gauge |
| `icon` | built-in name | `spark` | icon, if `svg` is missing |
| `svg` | string (inline SVG markup) | — | icon; takes priority over `icon` |
| `descriptor` | string | — | **not drawn**. Hook id for live data. |
| `hook` | string | — | **not drawn**. Note for whoever wires the widget. |

### `text`

Small label. `text` wraps.

### `metric`

Large number. `text` stays on one line.

```json
{
  "id": "temp",
  "kind": "metric",
  "x": 8,
  "y": 28,
  "w": 70,
  "h": 24,
  "text": "21°",
  "fontSize": 44,
  "fontWeight": 650,
  "letterSpacing": -1.2,
  "color": "#f4f5f7",
  "align": "left",
  "valign": "top",
  "descriptor": "climate.indoorTemp",
  "hook": "Indoor temperature, including the degree suffix."
}
```

### `icon`

Either a built-in name or inline SVG.

Built-in `icon` values:

`spark`, `sun`, `cloud`, `bolt`, `drop`, `thermo`, `bulb`, `play`, `pause`, `speaker`, `wifi`, `clock`, `home`, `heart`, `star`, `moon`, `check`, `warn`, `leaf`, `activity`

```json
{
  "id": "sun",
  "kind": "icon",
  "x": 8,
  "y": 8,
  "w": 14,
  "h": 28,
  "icon": "sun",
  "color": "#FF9F0A"
}
```

Custom SVG (keep it simple: `viewBox`, paths, no scripts):

```json
{
  "id": "logo",
  "kind": "icon",
  "x": 8,
  "y": 8,
  "w": 16,
  "h": 32,
  "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"8\"/></svg>",
  "color": "#2d7bff"
}
```

`currentColor` follows `color`.

### `bar`

`value` is 0–100. `fill` is the track, `accent` is the fill.

### `gauge`

Circular meter. `value` is 0–100. Center label is `text`, or `value` if `text` is missing.

### `button` / `chip`

Pills with `text`. Button defaults to accent fill and white text. Chip defaults to a faint fill.

### `divider` / `box`

Solid rectangles. Divider is a thin rule; box is a panel behind other elements. Put the box **earlier** in the array so it sits underneath.

## Descriptors

`descriptor` and `hook` never appear on the home screen. They exist so a size can be wired to live data later.

Use a stable dotted id, for example `climate.indoorTemp`. Keep `hook` as a human note.

## Minimal example

A `1x1` only indoor tile. A copy lives at [`examples/indoor-stat.judie-widget.json`](examples/indoor-stat.judie-widget.json).

To also offer a wide tile, add a `"1x2"` array with its own elements. Do not reuse the `1x1` objects by reference — duplicate them and give that size its own `id`s if you copy/paste.

## Checklist

- JSON is valid (trailing commas will fail).
- `format` is `judie-widget`.
- `widget.id` and `widget.layouts` exist.
- Each element has `id`, `kind`, `x`, `y`, `w`, `h`.
- Kind names are lowercase: `text`, not `Text`.
- At least one layout array is non-empty, or the gallery will say the widget has no completed sizes.
- Positions are percents, not pixels.
- `descriptor` / `hook` are optional and invisible.
