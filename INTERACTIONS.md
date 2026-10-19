# Geolava — Interaction Reference

Detailed spec of how the **input**, **cards**, and **map** behave: every state, transition, easing, duration, and the rules that connect them. All values are taken directly from `index.html`.

---

## Design tokens

| Token | Value | Use |
|---|---|---|
| BG / primary | `#FEFEFB` | panel, input, popovers |
| BG / secondary | `#F7F6F1` | icon buttons, area-pills tray |
| Divider | `#DFDFDE` | hairlines |
| Stroke / panel | `#BEBEBD` | input & card borders, non-active |
| Font / primary (“black”) | `#282823` | text, active strokes |
| Font / secondary | `#939391` | placeholders, captions |
| Action / primary (“purple”) | `#6266E6` | send, chips, selected accents |
| Font family | `DM Sans` | everything |

**Signature easings**
- **Smooth ease-out** `cubic-bezier(0.16, 1, 0.3, 1)` — most enter/settle motion.
- **Slight overshoot** `cubic-bezier(0.175, 0.885, 0.32, 1.1)` — tool-chip slide-in.
- **Hover-in** `cubic-bezier(0.5, 0, 0.30, 1)` — card raise.
- **Spring** `linear(0, 0.13, 0.417, 0.731, 0.986, 1.144, 1.205, 1.193, 1.14, 1.074, 1.016, 0.977, 0.959, 0.958, 0.967, 0.981, 0.994, 1.003, 1.008, 1.009, 1.007, 1.005, 1.002, 1, 1)` — a mass-1 / stiffness-500 / damping-20 spring sampled into a `linear()` curve (≈20% overshoot), used for the card drop on mouse-leave.

---

## Layout

```
┌───────────────────────────────┬──────────────────────────────┐
│  HOME PANEL (780px, #FEFEFB)   │   MAP (Mapbox, full-bleed)   │
│  ┌──┐                          │   ┌ Satellite|Digital|Map ┐  │
│  │side│  rotating heading       │             ＋ − ◎          │
│  │menu│  3 cards                │                              │
│  └──┘  ┌── area-pills notch ─┐ │   (draw canvas overlays here)│
│        │  command input       │ │                              │
└───────────────────────────────┴──────────────────────────────┘
```

- The **panel** is fixed `780px`, rounded on the right, `z-index: 10`. The **map** fills the viewport behind it.
- Map overlays (style switch, zoom, compass) sit at `z-index: 11`.
- The **draw canvas** overlays the map at `z-index: 5` (below the panel) and is only `display:block` in draw mode.

---

## Rotating heading

The hero `<h1>` cycles through four prompts:
`Analyze a location → Unlock full potential → Start a due diligence → Underwrite a property → …`

- **Cadence:** new phrase every **3.2s**.
- **Swap (blur + bottom-up):**
  1. `.swap-out` → `opacity:0; filter:blur(8px); translateY(-14px)` (rises up & blurs out) over **0.45s**.
  2. After 450ms the text is replaced and instantly jumped to `.swap-in` (`translateY(14px)`, transition disabled).
  3. Class removed → it rises from below to `translateY(0)`, sharpening + fading in.
- Easing: `opacity/filter` = `ease`, `transform` = `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## Cards (Pick · Search · Draw)

Three `210×248` cards, each with imagery, a title, and a caption. Each has a `data-action` (`pick` / `search` / `draw`).

### States

| State | Visual |
|---|---|
| **Default** | flat, `#F7F6F1`, ring at `0` spread (invisible, tucked under the card) |
| **Hover** | lifts `translateY(-12px)` |
| **Selected** | lifts `translateY(-12px)` **+** a ring: `box-shadow: 0 0 0 4px #FEFEFB, 0 0 0 5px #282823` → a **4px white gap + 1px black stroke** |

### Animations
- **Hover-in:** `transform 250ms cubic-bezier(0.5, 0, 0.30, 1)`.
- **Mouse-leave:** `transform 600ms` **spring** `linear(…)` — the card drops with a slight overshoot/settle.
- **Ring (select):** the `box-shadow` spread animates from `0`→`4px/5px` over `250ms ease`, so the stroke **grows out from under the card** rather than popping in. Deselect reverses it.

### Behavior (single-select, drives modes)
Clicking a card deselects the others, selects it, and:
- **Draw** → enters **draw mode** (shows the draw chip, canvas on).
- **Pick** → enters **comment mode** (arms the cursor+assistant).
- **Search** (and any non-map card) → focuses the chat input (deferred via `requestAnimationFrame` so focus reliably sticks).
Clicking another card, or the same card again, turns the previous mode off. Modes are mutually exclusive.

---

## Command input

A `max-width: 664px` rounded box. Children, left→right: **add button (`+`)**, **tool chips**, **text field** (flex-grow), **send button**. Spacing is via margins (not flex `gap`) so the send button can collapse cleanly.

### Border / focus
- Default border `#BEBEBD`.
- **Black border** (`#282823`) only when the **text field itself** is focused (`.input-active`, toggled on `focus`/`blur`) — over `0.15s`. Opening the add menu (which focuses the `+` button) deliberately does **not** turn it black.

### Add button (`+` ⟷ `×`) — blur crossfade
Two icons stacked in a `16px` box:
- Closed: `add-square-dashboard` visible (`opacity:1, blur 0`), close `×` hidden (`opacity:0, blur 3px`).
- Open (`#add-btn[aria-expanded="true"]`): they crossfade — add → `opacity 0, blur 3px`; close → `opacity 1, blur 0`.
- Transition: `opacity 0.26s ease, filter 0.26s ease`.

### Add popover (modes menu)
Opens **above** the input, left-aligned to the input box, `8px` gap (`bottom: calc(100% + 9px)`), no shadow. Items: **Add file · Comment · Draw the area · Search address**.
- **Open/close:** `opacity 0.18s ease`, `transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)` from `translateY(8px) scale(0.97)` → `translateY(0) scale(1)`.
- **Triggers:** click `+`; or type **`/`** on an empty input (the `/` is suppressed); closes on item click, outside click, or `Esc`.

### Tool chips (Draw / Comment)
A small purple pill appears in the input while a map-mode is active — pencil for **Draw**, speech-bubble for **Comment** (both `#6266E6`).
- **Slide-in:** the slot animates `max-width 0→44px`, `margin-left 0→8px`, `opacity`, `translateX(-14px)→0` over **0.34s** with the **overshoot** curve `cubic-bezier(0.175, 0.885, 0.32, 1.1)` — it grows out from under the `+` button.
- **Hover:** icon crossfades (`opacity 0.18s`) to a purple **×**.
- **Click:** removes the chip and cancels its mode.
- Only one chip shows at a time (draw and comment are mutually exclusive).

### Send button
Circular `40px`, `#6266E6`, white up-arrow.
- Hidden by default (`opacity:0; pointer-events:none`), **fades in** when the field has ≥1 char (`.has-text`), over `opacity 0.2s ease`. It always occupies its slot, so the input width doesn't jump.
- Click / `Enter` → submits (logs + clears the field).

### Double-Backspace
Two `Backspace` presses within **500ms** on an **empty** input call `clearActiveModes()` — turns off draw, comment, and any selected card at once. A single backspace, or two more than 500ms apart, does nothing.

---

## Map

Mapbox GL, centered `[-73.96, 40.78]` @ zoom `13`.

### Style switch — `Satellite · Digital Twin · Map`
A glass pill, top of the map. Active button = white fill / black text; others transparent / white text (`background/color 0.2s`). Satellite & Digital Twin use the satellite style; Map uses a custom style.

### Zoom & compass (glass controls, top-right)
- `＋ / −` vertical pill → `map.zoomIn()/zoomOut()`.
- Compass/street-view glass button → rotates to mirror the map bearing (`rotate 0.3s`); click eases bearing/pitch back to 0.

---

## Mode 1 — Draw

Entered via the **Draw card** or the **“Draw the area”** menu item. Shows the **pencil chip** and a pencil-cursor canvas over the map; map gestures are disabled while drawing.

**Drawing**
- Click-drag a freehand loop. The stroke renders live (`#FFFFFF`, 4px) with a translucent fill.
- On release it must be **closed** (start/end within `80px`) and have **≥10 points**, else it's discarded.

**On finish (per area)**
1. Screen points → lng/lat (`map.unproject`).
2. Rendered on the map: a white outline + a **30-step gradient fill** (concentric Turf buffers fading inward).
3. A **Zone N** chip is attached in the notch above the input.
4. Draw mode **stays on** so you can draw more areas (clear the chip to exit).

**Area pill (“Zone N” chip)**
- Default: `#BEBEBD` border, transparent bg, zone icon + label (all `currentColor` = `#282823`). The close `×` (your Figma close icon) is always shown on the right.
- **Hover:** border → black `#282823`.
- **Click body → selected:** everything turns **purple** (`#6266E6` border + icon + label, no fill) and the area highlights/zooms on the map (`fitBounds` with left-padding `820` so it centers in the visible map area). Click again to deselect.
- **Click `×`:** removes the area's map layers and the pill.

**Area-pills notch** (the tray that holds the chips, behind the input top)
Three-layer collapse (`row → padding-free inner → padded content`) so it collapses to a true `0`:
- **Appear:** `max-height 0→content`, `opacity`, `translateY(16px)→0`, border fade — **0.4s** `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Disappear:** **0.2s** `ease-in`, `opacity → 0.5` (the last chip's removal animates the close, then the chip is dropped after 220ms).
- `max-height` is set in JS to the **real content height** so the easing maps 1:1 to the visible motion (no lingering/jump).

---

## Mode 2 — Comment

Entered via the **Pick card**, the **“Comment”** menu item, or the **`C`** key. Shows the **comment chip** in the input.

**Aiming (armed)**
- A custom **cursor** (`Cursor.svg`, 28px) **and the AI assistant** (lottie, 44px box, sphere zoomed `scale(2.4)`) follow the mouse — but **only over the map** (`clientX > 780`); they hide over the panel.
- The OS cursor is hidden over the map (`body.commenting`) so only the custom cursor shows.
- The assistant sits just **down-right of the cursor** (`cursorX+16, cursorY+12`), cursor at its top-left.
- The armed popup is `pointer-events:none` so the placing click passes through it.
- Dot/cursor scale-in: `transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)`, `opacity 0.2s`.

**Placing**
- **Left-click on the map** fixes the cursor at that point and reveals the comment **input directly under the assistant** (the popup is a column `[assistant] → [input]`; nothing repositions). OS cursor is restored so the input is usable.
- Input entrance: `quickAskInputIn` — `opacity 0→1`, `translateY(10px)→0`, `scale(0.96)→1` over **0.32s** `cubic-bezier(0.16, 1, 0.3, 1)`.

**Submitting**
- Type + `Enter`/send → the text **flies** to the chat input (`all 0.6s cubic-bezier(0.16, 1, 0.3, 1)`, fading/shrinking), which then populates the field (so the send button appears). Comment mode ends.

**Cancel:** `Esc`, clicking outside the placed input, the comment chip's `×`, switching to another card/mode, or double-Backspace.

---

## Mode interaction matrix

| Trigger | Draw | Comment | Card selected | Input focus |
|---|---|---|---|---|
| Draw card / menu | **on** | off | Draw | — |
| Pick card / menu / `C` | off | **on** | Pick | — |
| Search card | off | off | Search | **focused** |
| Type `/` (empty) | — | — | — | opens menu |
| Double-Backspace (empty) | off | off | cleared | — |

Draw and Comment are never active at the same time; entering one ends the other.
