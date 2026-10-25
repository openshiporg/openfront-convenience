---
name: Openfront Convenience Storefront
description: The store's register receipt, printed at night.
colors:
  counter-ground: "oklch(15.5% 0.014 44)"
  receipt-paper: "oklch(20% 0.016 44)"
  receipt-paper-raised: "oklch(24.5% 0.018 44)"
  counter-well: "oklch(12% 0.012 44)"
  thermal-ink: "oklch(95.5% 0.012 85)"
  faded-ink: "oklch(81% 0.014 80)"
  ghost-ink: "oklch(68% 0.014 80)"
  perforation: "oklch(34% 0.018 44)"
  lit-sign: "oklch(73% 0.17 44)"
  lit-sign-bright: "oklch(80% 0.15 44)"
  lit-sign-ink: "oklch(17% 0.04 44)"
  void-red: "oklch(71% 0.19 25)"
typography:
  display:
    fontFamily: "Doto, Sofia Sans Semi Condensed, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.75rem, calc((min(100vw, 1360px) - 2 * var(--sf-gutter)) / (var(--len, 14) * 0.6)), 12rem)"
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.6vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
  title-aisle:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 1vw, 1.875rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    letterSpacing: "-0.01em"
  lead:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)"
    lineHeight: 1.35
  body:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sofia Sans Semi Condensed, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  price:
    fontFamily: "Doto, Sofia Sans Semi Condensed, ui-sans-serif, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  price-hero:
    fontFamily: "Doto, Sofia Sans Semi Condensed, ui-sans-serif, sans-serif"
    fontSize: "clamp(3.5rem, 2.6rem + 3vw, 5.5rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  price-fuel:
    fontFamily: "Doto, Sofia Sans Semi Condensed, ui-sans-serif, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 1.6vw, 2.75rem)"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
rounded:
  edge: "3px"
  dot: "50%"
spacing:
  gutter: "clamp(16px, 2.6vw, 36px)"
  slip: "clamp(18px, 2.4vw, 28px)"
  tight: "8px"
  row: "16px"
  block: "24px"
  container: "1360px"
components:
  button-primary:
    backgroundColor: "{colors.lit-sign}"
    textColor: "{colors.lit-sign-ink}"
    rounded: "{rounded.edge}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.lit-sign-bright}"
    textColor: "{colors.lit-sign-ink}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.thermal-ink}"
    rounded: "{rounded.edge}"
    padding: "0 22px"
    height: "48px"
  pill:
    backgroundColor: "transparent"
    textColor: "{colors.faded-ink}"
    rounded: "{rounded.edge}"
    padding: "0 14px"
    height: "40px"
  pill-current:
    backgroundColor: "{colors.lit-sign}"
    textColor: "{colors.lit-sign-ink}"
    rounded: "{rounded.edge}"
    padding: "0 14px"
    height: "40px"
  chip:
    backgroundColor: "{colors.receipt-paper-raised}"
    textColor: "{colors.faded-ink}"
    rounded: "{rounded.edge}"
    padding: "0 7px"
    height: "22px"
  input:
    backgroundColor: "{colors.counter-well}"
    textColor: "{colors.thermal-ink}"
    rounded: "{rounded.edge}"
    padding: "0 14px"
    height: "44px"
  input-scan:
    backgroundColor: "{colors.receipt-paper}"
    textColor: "{colors.thermal-ink}"
    rounded: "{rounded.edge}"
    padding: "0 14px 0 48px"
    height: "56px"
  slip:
    backgroundColor: "{colors.receipt-paper}"
    textColor: "{colors.thermal-ink}"
    rounded: "{rounded.edge}"
    padding: "{spacing.slip}"
---

# Design System: Openfront Convenience Storefront

Scope: the customer storefront (`features/storefront`). The merchant dashboard is a shared platform shell and is not governed by this file.

## Overview

**Creative North Star: "The Night Receipt"**

The storefront is the store's own register receipt, printed at night. Every fact the store knows (today's open state, address, phone, fuel, aisles, items, a customer's receipts) is set as an itemised line: the name at one end, the value at the other, joined by a dotted leader. The lines sit on slips of receipt paper that end in a torn, zigzag foot, laid on a near-black counter. The page is dense in the way a receipt is dense, with no hero imagery and no grid of product cards.

There are three inks and one light. The counter, paper and well are warm near-blacks tinted a few degrees toward the store's logo hue. Thermal-white ink carries the text in three strengths. The single lit-sign accent, also in the logo hue, marks what is live or actionable. The store name, prices and totals print in Doto, a dot-matrix face, and everything else is set in Sofia Sans Semi Condensed.

The whole palette follows the store. `ShopShell` sets `--sf-h` from the store's logo colour at runtime, and every grounded and accented token rotates with it. The values recorded here are the default hue (44, a warm orange), not a fixed brand colour.

**Key Characteristics:**
- Itemised rows with dotted leaders are the main layout device.
- Receipt slips have square-ish top corners and a torn zigzag foot.
- Dot-matrix numerals for the store name, prices and totals only.
- One accent in the store's logo hue, for live state and action only.
- Selected states are solid fills and everything else is outlined.
- The home receipt feeds out top-down once on load, like a printer.

## Colors

A warm near-black counter, thermal-white ink in three strengths, and one lit-sign accent that rotates with the store's logo hue.

### Primary
- **Lit Sign** (lit-sign): the only accent. It colours the open-status dot, the primary button, the current aisle or nav pill, today's marker in the hours list, the posted fuel prices, the focus ring, text selection, and hover on aisle names, product titles and footer links.
- **Lit Sign Bright** (lit-sign-bright): hover fill for the primary button only.
- **Lit Sign Ink** (lit-sign-ink): text on any lit-sign fill (primary button, current pill, selection).

### Neutral
- **Counter Ground** (counter-ground): the page ground.
- **Receipt Paper** (receipt-paper): slips, receipts, account panels, the hero search field, and the phone menu sheet.
- **Raised Paper** (receipt-paper-raised): chips, photo placeholders, and hover on linked receipt panels.
- **Counter Well** (counter-well): the darkest layer. Used for the top strip, the sticky header bar and form inputs.
- **Thermal Ink** (thermal-ink): primary text and values.
- **Faded Ink** (faded-ink): labels, secondary rows, aisle item lists, the header strip.
- **Ghost Ink** (ghost-ink): counts, metadata, placeholders, icons inside fields, muted status dots.
- **Perforation** (perforation): dotted leaders, dotted row dividers, outlines on quiet buttons, pills and inputs.

### Semantic
- **Void Red** (void-red): error alerts (outlined) and the danger status dot only.

### Named Rules
**The One Light Rule.** The lit-sign accent is reserved for live state, action, the current location, and the posted fuel price. Body text, headings and paper never take it at rest.

**The Store's Hue Rule.** Grounds, perforation and accent are written as `oklch(L C var(--sf-h))`. Never hard-code a hue. The store's logo sets it.

## Typography

**Display Font:** Doto (with Sofia Sans Semi Condensed, ui-sans-serif fallback), weights 700 and 900
**Body Font:** Sofia Sans Semi Condensed (with ui-sans-serif, system-ui fallback)

**Character:** A receipt printer's dot matrix set against a narrow, sturdy grotesk. The matrix carries the store's name and its numbers, and the grotesk carries everything a person reads.

### Hierarchy
- **Display** (Doto 900, length-fitted up to 12rem, 0.92): the store name on the home page, sized from its character count (`--len`) so it spans the measure on one line.
- **Headline** (Sofia 700, fluid 2 to 3.5rem, 1): page and product titles. Balanced wrap.
- **Title, aisle** (Sofia 800, fluid 1.375 to 1.875rem, 1.1): aisle names on the home receipt.
- **Title** (Sofia 800, 1.5rem): slip and section heads (Aisles, Fuel, Hours, Receipts), followed by a small ghost-ink count.
- **Lead** (fluid 1.25 to 1.5rem, 1.35): the store tagline (max 40ch) and today's open line.
- **Body** (Sofia 400, 1.0625rem, 1.5): default text. Product descriptions run 1.125rem with a 62ch max.
- **Label** (Sofia 600, 0.875rem): row labels, counts, metadata, the header strip.
- **Price** (Doto 900, 2rem; 1.75rem on phones): currency symbol and cents set at 0.5em and raised beside the units. Hero price is fluid 3.5 to 5.5rem, and fuel prices are fluid 2 to 2.75rem in lit-sign.

### Named Rules
**The Printer's Numbers Rule.** Doto sets only the store name, prices and receipt totals. Page titles, product titles and all running text stay in Sofia. Phone numbers and hours use tabular numerals in Sofia, not Doto.

**The Plain Case Rule.** Nothing is uppercased or letter-spaced into a label. Hierarchy comes from weight and size.

## Layout

The receipt column is the grid. Content sits in a 1360px container with a fluid gutter (16 to 36px). The home page opens with the full-width store name, then the store facts slip (Today, Address, Phone), then a wide search line with Search and Shop the store. Below that, a counter splits 7fr / 5fr: the aisles receipt on the left and a sticky side column (top 92px) with Fuel and Hours slips. The shop page is one itemised slip of product rows, and the product page is one receipt (max 720px, or 5fr / 6fr beside a photo when there is one).

Rows are flex lines: label, a flexible dotted leader (min 24px), value. When a value can wrap, the leader stays on the first line. Spacing steps are 8px inside rows, 16px between row groups, 24px between blocks, and fluid section gaps (40 to 72px).

Breakpoints: at 1080px the counter stacks and the side column becomes an auto-fit grid (min 280px). At 760px the header search and nav collapse into a phone menu, the hero search wraps with the input on its own line, product rows drop their leader and photos shrink to 52px. At 420px, fact rows wrap.

**The Itemised Line Rule.** Any fact with a name and a value is a row joined by a dotted leader, never a label stacked over a value in a box.

## Elevation & Depth

The surfaces are flat. Depth comes from three tonal layers (well, ground, paper, with raised paper for hover and chips), not from shadows. The only shadow is under the phone menu sheet, which floats over content.

### Shadow Vocabulary
- **Menu drop** (`box-shadow: 0 24px 40px -16px rgb(0 0 0 / 0.7)`): the phone menu sheet only.

**The Paper-On-Counter Rule.** A surface is lifted by being lighter paper, not by a shadow or a border.

## Shapes

Corners are nearly square (3px) on everything: buttons, pills, inputs, chips, photos. Receipt slips round only their top corners and end in a torn foot: a 10px band of repeated 16px-wide downward triangles in the same paper colour, masked below the slip. Dividers inside receipts are 2px dotted perforation lines. The only circles are the 8px status dots and the 6px today marker.

**The Torn Foot Rule.** A slip that represents a printed receipt (store facts, aisles, fuel, hours, shop list, product receipt, receipt detail, footer, auth form) ends in the torn foot. Panels that are not printed receipts (profile, order and rewards panels, empty cards) are fully rounded at 3px with no tear.

## Components

### Buttons
Firm and plain, with press feedback.
- **Shape:** near-square (3px), 1.5px border, min height 48px (44px small).
- **Primary:** lit-sign fill and border, lit-sign-ink text, 700 weight, 1rem.
- **Hover / Focus:** hover brightens to lit-sign-bright on fine pointers. Active scales to 0.97. Focus is a 2px lit-sign outline at 3px offset.
- **Quiet:** transparent with a perforation border and thermal-ink text. Hover lifts the border to faded ink.

### Pills (aisle and nav tracks)
- **Style:** 40px tall, 1.5px perforation outline, faded-ink 600 text. Header nav pills drop the outline.
- **State:** the current page is a solid lit-sign fill. Hover on others lifts the border to ghost ink and the text to thermal ink. On phones the aisle track scrolls horizontally, edge to edge.

### Chips
- **Style:** raised-paper fill, faded-ink 700 text at 0.8125rem, 22px tall. Used for the "Made in store" fact on items.

### Slips / Receipts
- **Corner Style:** 3px top corners, torn foot below.
- **Background:** receipt paper on the counter ground.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none. Inner rows divide with 2px dotted perforation.
- **Internal Padding:** fluid 18 to 28px.

### Inputs / Fields
- **Style:** counter-well fill, 1.5px perforation border, 3px corners, 44px tall (48px in auth forms), 16px text, ghost-ink placeholder. The home search line is taller (56px) on receipt paper, with the search icon inset at 18px.
- **Focus:** the border turns lit-sign.
- **Error:** an outlined void-red alert with a danger dot above the form.

### Navigation
- **Style:** a counter-well strip (36px) carries today's status, address and phone. Below it is a sticky counter-well bar (68px; 60px on phones) with the store logo and name (800, 1.125rem), a header search (up to 380px), and Shop / Account pills. On phones, a bordered 44px menu toggle opens a receipt-paper sheet with 1.375rem links divided by dotted perforation, the current link in lit-sign.

### Itemised Row (signature)
A label in faded ink (600), a flexible 2px dotted leader, and a value in thermal ink or Doto price. Used for store facts, footer lines, aisles (name, leader, item count, arrow), product rows (photo, title and meta, leader, price), product options and receipt totals.

### Status Dot (signature)
An 8px circle before a status label: lit-sign for open or active, faded ink for warning, void red for danger, ghost ink for muted or closed.

### Printer Feed (signature motion)
On load, home receipt lines fade in from 10px above, staggered 40ms per line after a 120ms delay (560ms, `cubic-bezier(0.23, 1, 0.32, 1)`). The store name prints in with a top-down clip over 700ms. All of it is gated on `prefers-reduced-motion: no-preference` and runs once.

## Do's and Don'ts

### Do:
- **Do** derive every grounded and accented colour from `--sf-h` so the storefront follows the store's logo hue.
- **Do** set any name/value fact as an itemised row with a 2px dotted leader.
- **Do** end printed-receipt slips with the torn foot, in the slip's own paper colour.
- **Do** keep the lit-sign accent for live state, the primary action, the current location and posted fuel prices.
- **Do** make selected states solid and leave the rest outlined.
- **Do** use Doto 900 for the store name, prices and totals, with cents and currency raised at 0.5em.
- **Do** gate hover on `(hover: hover) and (pointer: fine)` and motion on `prefers-reduced-motion: no-preference`; keep 0.97 press feedback on buttons and pills.
- **Do** keep touch targets at 44px or larger.

### Don't:
- **Don't** build a hero-plus-card-grid shop page; products are rows on a slip.
- **Don't** return to light paper grounds or flat grey neutrals; every neutral is tinted toward the store's hue.
- **Don't** add shadows to slips or cards; lift with lighter paper.
- **Don't** introduce a second accent hue. Void red is for errors only.
- **Don't** set running text, page titles or phone numbers in Doto.
- **Don't** round corners past 3px or soften the torn foot into a curve.
- **Don't** uppercase or letter-space labels into eyebrows above headings.
