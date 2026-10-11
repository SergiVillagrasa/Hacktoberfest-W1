---
name: SnapHunt
description: A clean, confident, tactile outdoor photo game hosted by a pug, for all ages.
colors:
  leaf: "oklch(0.54 0.17 142)"
  leaf-edge: "oklch(0.42 0.14 145)"
  leaf-soft: "oklch(0.96 0.04 145)"
  ink: "oklch(0.27 0.03 160)"
  ink-soft: "oklch(0.5 0.025 160)"
  line: "oklch(0.9 0.008 150)"
  line-deep: "oklch(0.82 0.012 150)"
  white: "#ffffff"
  sun: "oklch(0.88 0.17 95)"
  sun-edge: "oklch(0.72 0.15 85)"
  bow: "oklch(0.58 0.22 27)"
  bow-edge: "oklch(0.45 0.19 27)"
  sky: "oklch(0.55 0.15 240)"
  sky-edge: "oklch(0.42 0.13 242)"
  fawn: "oklch(0.84 0.1 78)"
  fawn-edge: "oklch(0.68 0.12 68)"
typography:
  display:
    fontFamily: "Rubik, ui-rounded, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  button:
    fontFamily: "Rubik, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  body:
    fontFamily: "Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
rounded:
  control: "0.875rem"
  card: "1rem"
spacing:
  gap: "0.75rem"
  screen: "1.25rem"
components:
  button-primary:
    backgroundColor: "{colors.leaf}"
    textColor: "{colors.white}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "3.5rem"
    padding: "0 1.25rem"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    height: "3.5rem"
  button-danger:
    backgroundColor: "{colors.bow}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "3.5rem"
  button-info:
    backgroundColor: "{colors.sky}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    height: "3.5rem"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
  card-selected:
    backgroundColor: "{colors.leaf-soft}"
    rounded: "{rounded.card}"
---

# Design System: SnapHunt

## Overview

**Creative North Star: "The Park Game Night"**

SnapHunt looks like a good game night in a park: bright daylight, open space, a relaxed host and friends who each know exactly what to do next. It is a clean white interface with one confident green action per screen, bordered controls that visibly press down, and a pug host standing directly on the page. It is built for adults and kids equally, with the polish of a modern language-learning app rather than the loudness of a children's game.

The mood is encouraging, bold and legible, and tactile. Misses are met with kindness, not red penalties; success is celebrated by the host. Color works hard and carries meaning: green means go, yellow means points, red means danger, blue means information and focus. Depth comes from solid pressed edges, not blur.

It explicitly rejects childish pastel palettes and bubbly display fonts, a neon arcade look (dark grounds with glowing edges), and cutesy clutter (sparkles, stars and emoji scattered as decoration).

**Key Characteristics:**
- One confident leaf-green primary action per screen on a clean white ground.
- Bordered controls with a 4px darker bottom edge that collapses on press.
- Rubik at heavy weights for headings and uppercase tracked button labels, over Nunito body text.
- Light theme only: the use scene is direct daylight outdoors.
- The pug stands directly on the page with a soft neutral ground shadow, never inside a colored tile.

## Colors

A white ground with a single committed green, kept confident and accessible, and meaningful accent colors used only for what they mean.

### Primary
- **Leaf** (oklch(0.54 0.17 142)): the primary action, the wordmark and selected states. White text on it is 4.7:1.
- **Leaf Edge** (oklch(0.42 0.14 145)): the pressed edge under Leaf buttons; also the text color for green links on white (7.2:1).
- **Leaf Soft** (oklch(0.96 0.04 145)): the fill of selected cards and "ready" rows.

### Secondary
- **Sky** (oklch(0.55 0.15 240)): links, informational buttons, the focus ring and the text caret. 4.7:1 on white, and distinct from green so focus is always visible around green buttons.
- **Sky Edge** (oklch(0.42 0.13 242)): its pressed edge.

### Tertiary
- **Sun** (oklch(0.88 0.17 95)): points, scores and the text-selection highlight, with ink text.
- **Bow** (oklch(0.58 0.22 27)): the bow-tie red. Danger, low time, destructive actions. White text on it is 4.8:1.
- **Fawn** (oklch(0.84 0.1 78)): the pug's coat. Host and "ready" accents only.
- Each has an `-edge` companion for its pressed edge.

### Neutral
- **White** (#ffffff): the page and every surface.
- **Ink** (oklch(0.27 0.03 160)): all primary text, a green-black (14.9:1 on white).
- **Ink Soft** (oklch(0.5 0.025 160)): secondary text (5.9:1 on white).
- **Line** (oklch(0.9 0.008 150)) and **Line Deep** (oklch(0.82 0.012 150)): borders, separators, disabled fills and bottom edges of neutral controls.

### Named Rules
**The One Green Rule.** Leaf is the one go-signal. A screen has one primary Leaf action; everything else is secondary or informational.
**The Meaning Rule.** Sun, Bow, Sky and Fawn appear only when they carry meaning. They are not decoration.
**The Visible Focus Rule.** Focus is a 3px Sky ring with a 3px offset, never green, so it stays visible on green controls.

## Typography

**Display Font:** Rubik (with ui-rounded, system-ui)
**Body Font:** Nunito (with ui-rounded, system-ui)

**Character:** Rubik has slightly rounded corners and confident heavy weights: friendly and clear but clearly grown-up. Nunito stays warm and very readable for clue text. Both are self-hosted variable fonts (Fontsource) so builds never depend on Google Fonts, and are kept at 600 or heavier so text survives sunlight.

### Hierarchy
- **Display** (800, 2.25rem, 1.0, -0.025em): the SnapHunt wordmark and screen titles, balanced wrapping.
- **Button** (700, 1rem, 1.0, +0.04em, uppercase): every control label.
- **Body** (600, 1rem, 1.5): clues, helper lines and feed text, within 65 to 75 characters per line.

### Named Rules
**The Heavy Weight Rule.** Nothing is set lighter than 600. Thin type disappears in daylight.
**The Tabular Rule.** Scores, timers and counts use tabular numerals (`.tabular`) so digits do not jitter.

## Layout

A single centered column, at most 28rem wide, on every screen size: phone-first, with wider screens simply showing the same column over white. Screens fill `100dvh` and respect the device safe-area insets. Content stacks vertically with 0.75rem to 1.5rem gaps and 1.25rem side padding. The primary action sits in the thumb zone at the bottom, the host fills the middle, and the title sits on top.

## Elevation & Depth

Depth is structural, not ambient. Controls and cards are flat with a 2px border and a solid, darker 4px bottom edge that reads as thickness; pressing collapses the edge to 2px and moves the control down 2px. There are no soft glows or blur shadows on controls. The only soft shadow is the mascot's neutral ground shadow.

### Named Rules
**The Pressed-Edge Rule.** The 4px bottom edge is the system's one depth device and the signature interaction. It is implemented as `border-bottom` so it follows the rounded corners.

## Shapes

Rounded and confident but never pill-shaped or bubbly: controls 0.875rem, cards 1rem. Borders are always 2px, with a 4px bottom edge on interactive surfaces. The mascot is the only organic shape on the page.

## Components

### Buttons
- **Shape:** 0.875rem radius, minimum 3.5rem tall, full width in the primary column, uppercase Rubik label with +0.04em tracking.
- **Primary:** Leaf fill and border with a white label and a Leaf Edge bottom.
- **Secondary:** white with a Line border and a Line Deep bottom, Ink label.
- **Danger and Info:** Bow with white text, Sky with white text, each with its own edge.
- **Hover / Focus / Pressed:** hover brightens slightly; focus is the 3px Sky ring; pressed sinks 2px and collapses the edge to 2px.
- **Disabled:** Line fill, Ink Soft label, no hover.

### Cards
- **Corner Style:** 1rem radius.
- **Background:** white with a Line border and a Line Deep bottom edge. Selected cards use Leaf Soft with a Leaf border and Leaf Edge bottom.
- **Shadow Strategy:** none; the edge carries depth.

### Inputs / Fields
- **Style:** white fill, 2px Line border, 0.875rem radius, Ink text and Ink Soft placeholder.
- **Focus:** Sky ring and Sky border. Error uses Bow.

### Mascot
The pug host is a flat 2D illustration (`/mascot/idle.webp`) with its background cut out, standing on the white page with a neutral translucent ground shadow. It has no blush and no whiskers and wears a plain red bow tie. Its animation respects `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep one primary Leaf action per screen, full width.
- **Do** use the Pressed-Edge treatment for every tappable control (3.5rem minimum height).
- **Do** keep every spoken clue visible as text.
- **Do** keep text at 4.5:1 or better and use Sky for focus.
- **Do** honour `prefers-reduced-motion` for the pressed-edge transition and mascot motion.

### Don't:
- **Don't** use pastel tints, bubbly display fonts or color blocks that read as a children's app.
- **Don't** use a neon arcade look: no dark grounds, no glowing edges.
- **Don't** scatter sparkles, stars or emoji as decoration.
- **Don't** use gradient text or blur shadows on controls.
- **Don't** set text lighter than 600.
- **Don't** put Sun, Bow, Sky or Fawn to decorative use.
