---
name: SnapHunt
description: A chunky, tactile outdoor photo game hosted by a pug.
colors:
  grape: "oklch(0.5 0.23 295)"
  grape-edge: "oklch(0.37 0.2 295)"
  lilac: "oklch(0.955 0.035 300)"
  lilac-deep: "oklch(0.86 0.06 300)"
  lilac-art: "#cbbaf4"
  lilac-art-edge: "oklch(0.7 0.11 298)"
  fawn: "oklch(0.84 0.1 78)"
  fawn-edge: "oklch(0.68 0.12 68)"
  bow: "oklch(0.58 0.22 27)"
  bow-edge: "oklch(0.44 0.19 27)"
  mint: "oklch(0.8 0.16 160)"
  mint-edge: "oklch(0.6 0.15 160)"
  sun: "oklch(0.9 0.17 95)"
  sun-edge: "oklch(0.74 0.15 85)"
  ink: "oklch(0.24 0.05 295)"
  ink-soft: "oklch(0.42 0.05 295)"
typography:
  display:
    fontFamily: "Fredoka, ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  button:
    fontFamily: "Fredoka, ui-rounded, Arial Rounded MT Bold, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  button: "1.25rem"
  panel: "2rem"
  field: "1.5rem"
spacing:
  gap: "1rem"
  screen: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.grape}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "3.75rem"
    padding: "0 1.5rem"
  button-secondary:
    backgroundColor: "{colors.fawn}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    height: "3.75rem"
  button-danger:
    backgroundColor: "{colors.bow}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    height: "3.75rem"
  button-success:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    height: "3.75rem"
  panel:
    backgroundColor: "{colors.lilac-art}"
    rounded: "{rounded.panel}"
---

# Design System: SnapHunt

## Overview

**Creative North Star: "The Pug's Playground"**

SnapHunt looks and feels like a toy you can press: one friendly pug host, bold flat color blocks on a lilac ground, and buttons that visibly sink when you tap them. It is an operating screen for people standing in a park with one hand free, so everything is large, high-contrast and singular: one primary action per screen, one voice, one mascot who reacts to what just happened.

The mood is encouraging, bold and legible, and tactile. Misses are met with kindness, not penalties in red; success is celebrated by the host. The palette is tinted from the pug art itself (lavender backdrop, fawn coat, red bow tie) so the mascot never looks pasted onto the interface. Depth comes from solid pressed edges, not blur.

It explicitly rejects the neon arcade look (dark grounds with glowing edges) and cutesy kid-app clutter (sparkles, stars and emoji scattered as decoration).

**Key Characteristics:**
- Chunky pressable controls with a solid darker bottom edge that collapses on press.
- A full named palette (Grape, Lilac, Fawn, Bow, Mint, Sun, Ink) rather than a grey screen with one accent.
- Rounded display type (Fredoka) over a rounded humanist body (Nunito), always at heavy weights.
- Light theme only: the use scene is direct daylight outdoors.
- The pug art is a lavender color-block tile that sits inside the same pressed-edge language.

## Colors

A committed full palette tinted from the pug art: lavender ground and tiles, a deep violet for action, warm fawn for the secondary role, with red, mint and sun reserved for meaning.

### Primary
- **Grape** (oklch(0.5 0.23 295)): the brand and the primary action. White text on it passes 4.5:1. Used for the wordmark, primary buttons, focus rings and links.
- **Grape Edge** (oklch(0.37 0.2 295)): the pressed edge under Grape buttons.

### Secondary
- **Fawn** (oklch(0.84 0.1 78)): the pug's coat colour. Secondary buttons, "ready" states, default chips. Ink text on it.
- **Fawn Edge** (oklch(0.68 0.12 68)): its pressed edge.

### Tertiary
- **Bow** (oklch(0.58 0.22 27)): the bow-tie red. Danger, low time, destructive actions.
- **Mint** (oklch(0.8 0.16 160)): success and confirmed finds.
- **Sun** (oklch(0.9 0.17 95)): points, scores and the text-selection highlight.
- Each has an `-edge` companion for its pressed edge.

### Neutral
- **Lilac** (oklch(0.955 0.035 300)): the page ground, tinted toward violet, never grey or cream.
- **Lilac Deep** (oklch(0.86 0.06 300)): borders, separators, disabled fills.
- **Lilac Art** (#cbbaf4) and **Lilac Art Edge** (oklch(0.7 0.11 298)): the pug tile, matching the mascot art's own background pixel for pixel.
- **Ink** (oklch(0.24 0.05 295)): all primary text, a violet-black.
- **Ink Soft** (oklch(0.42 0.05 295)): secondary text on Lilac, at least 7:1.

### Named Rules
**The Pug-Tinted Rule.** Neutrals lean violet like the mascot art. Never use neutral grey or warm cream as a ground.
**The Meaning Rule.** Bow, Mint and Sun appear only when they carry meaning (danger, success, points). They are not decoration.

## Typography

**Display Font:** Fredoka (with ui-rounded, Arial Rounded MT Bold, system-ui)
**Body Font:** Nunito (with ui-rounded, system-ui)

**Character:** Fredoka is round and bouncy like the mascot's shapes; Nunito stays friendly but calm enough for clue text. Both are loaded with `next/font` and kept at 600 or heavier so text survives sunlight.

### Hierarchy
- **Display** (700, 2.5rem, 1.0): the SnapHunt wordmark and screen titles, balanced wrapping.
- **Button** (700, 1.25rem, 1.0): every control label.
- **Body** (600, 1rem, 1.5): clues, helper lines and feed text, within 65 to 75 characters per line.

### Named Rules
**The Heavy Weight Rule.** Nothing is set lighter than 600. Thin type disappears in daylight.
**The Tabular Rule.** Scores, timers and counts use tabular numerals (`.tabular`) so digits do not jitter.

## Layout

A single centered column, at most 28rem wide, on every screen size: phone-first, with wider screens simply showing the same column over the lilac ground. Screens fill `100dvh` and respect the device safe-area insets. Content stacks vertically with 1rem to 1.5rem gaps and 1.25rem side padding. The primary action sits in the thumb zone at the bottom, the host fills the middle, and the title sits on top.

## Elevation & Depth

Depth is structural, not ambient. Controls and panels are flat colour with a solid, darker bottom edge (6px) that reads as thickness; pressing collapses it to 2px and moves the control down 4px. There are no soft glows or blur shadows on controls. Focus uses a 3px Grape outline with a 3px offset.

### Named Rules
**The Pressed-Edge Rule.** The 6px bottom edge is the system's one depth device and the signature interaction. It is implemented as `border-bottom` so it follows the rounded corners.

## Shapes

Everything is rounded and soft but never pill-shaped: buttons 1.25rem, panels 2rem, fields 1.5rem. Corners are generous and consistent so controls feel like one family of toys. Borders on fields are 2px in Lilac Deep.

## Components

### Buttons
- **Shape:** 1.25rem radius, minimum 3.75rem tall, full width in the primary column.
- **Primary:** Grape with white Fredoka 700 label and a Grape Edge bottom border.
- **Secondary:** Fawn with Ink label and Fawn Edge.
- **Danger and Success:** Bow with white text, Mint with Ink text, each with its own edge.
- **Hover / Focus / Pressed:** hover brightens slightly; focus is the 3px Grape ring; pressed sinks 4px and collapses the edge to 2px.
- **Disabled:** Lilac Deep fill, Ink Soft label, no hover.

### Panels
- **Corner Style:** 2rem radius.
- **Background:** Lilac Art with a 6px Lilac Art Edge bottom border; used for the mascot and for hero color-blocks.
- **Shadow Strategy:** none; the edge carries depth.

### Inputs / Fields
- **Style:** white fill, 2px Lilac Deep border, 1.5rem radius, Ink text and Ink Soft placeholder.
- **Focus:** Grape ring and border. Error uses Bow.

### Mascot
The pug host is a flat 2D illustration (`/mascot/idle.webp`) shown on a Lilac Art panel. It has no blush and no whiskers, and wears a plain red bow tie. Its animation respects `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep one primary action per screen, full width, in Grape.
- **Do** use the Pressed-Edge treatment for every tappable control (3.75rem minimum height).
- **Do** keep every spoken clue visible as text.
- **Do** tint neutrals toward violet and keep text at 4.5:1 or better.
- **Do** honour `prefers-reduced-motion` for the pressed-edge transition and mascot motion.

### Don't:
- **Don't** use a neon arcade look: no dark grounds, no glowing edges.
- **Don't** scatter sparkles, stars or emoji as decoration.
- **Don't** use grey or cream grounds, gradient text, or blur shadows on controls.
- **Don't** set text lighter than 600.
- **Don't** put Bow, Mint or Sun to decorative use.
