---
name: Openfront Convenience
description: The shelf edge at night for customers; the shift log and safe-drop envelope for the store manager.
colors:
  channel-ground: "oklch(17% 0.014 44)"
  channel-strip: "oklch(11.5% 0.01 44)"
  channel-floor: "oklch(6% 0.006 44)"
  channel-lip: "oklch(31% 0.016 44)"
  channel-well: "oklch(21.5% 0.016 44)"
  channel-line: "oklch(34% 0.016 44)"
  night-ink: "oklch(96% 0.006 44)"
  night-ink-2: "oklch(84% 0.01 44)"
  night-ink-3: "oklch(70% 0.012 44)"
  tag-plate: "oklch(97.5% 0.004 95)"
  tag-unlit: "oklch(89% 0.006 44)"
  tag-ink: "oklch(19% 0.012 44)"
  tag-ink-2: "oklch(44% 0.014 44)"
  tag-rule: "oklch(88% 0.006 44)"
  aisle-sign: "oklch(48% 0.19 44)"
  aisle-sign-hi: "oklch(50% 0.19 44)"
  aisle-sign-ink: "oklch(98.5% 0.004 44)"
  hanger-wire: "oklch(46% 0.012 44)"
  focus-ring: "oklch(80% 0.12 44)"
  lamp-open: "oklch(80% 0.17 150)"
  lamp-warn: "oklch(84% 0.14 82)"
  lamp-danger: "oklch(71% 0.19 25)"
  lamp-off: "oklch(62% 0.012 44)"
  alert-ground: "oklch(29% 0.08 27)"
  alert-ink: "oklch(93% 0.035 27)"
  field-white: "oklch(100% 0 0)"
  field-rule: "oklch(76% 0.01 44)"
  envelope-kraft: "oklch(97.5% 0.018 80)"
  red-pencil: "oklch(52% 0.19 27)"
  green-ink: "oklch(50.8% 0.118 165.6)"
typography:
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  headline-product:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 2vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  price-hero:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontFeature: "tnum"
  price:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 0.92
    letterSpacing: "-0.005em"
    fontFeature: "tnum"
  sign:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  tag-size:
    fontFamily: "Barlow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
  ops-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.025em"
  ops-figure:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "20px"
    fontWeight: 500
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  ops-section:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  ops-body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  ops-label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
rounded:
  tag: "2px"
  control: "3px"
  ops-control: "4px"
  ops-panel: "6px"
spacing:
  gutter: "clamp(16px, 2.6vw, 36px)"
  tag-pad: "9px 10px 10px"
  shelf-row: "26px"
  ops-cell: "8px 12px"
  ops-row: "36px"
components:
  tag-plate:
    backgroundColor: "{colors.tag-plate}"
    textColor: "{colors.tag-ink}"
    rounded: "{rounded.tag}"
    padding: "9px 10px 10px"
  tag-plate-ask:
    backgroundColor: "{colors.tag-unlit}"
    textColor: "{colors.tag-ink-2}"
    rounded: "{rounded.tag}"
    padding: "9px 10px 10px"
  aisle-sign:
    backgroundColor: "{colors.aisle-sign}"
    textColor: "{colors.aisle-sign-ink}"
    typography: "{typography.sign}"
    rounded: "{rounded.tag}"
    padding: "6px 16px 6px 6px"
    height: "52px"
  aisle-sign-hover:
    backgroundColor: "{colors.aisle-sign-hi}"
  aisle-sign-current:
    backgroundColor: "{colors.aisle-sign-ink}"
    textColor: "{colors.aisle-sign}"
  button-primary:
    backgroundColor: "{colors.aisle-sign}"
    textColor: "{colors.aisle-sign-ink}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.aisle-sign-hi}"
  button-quiet:
    textColor: "{colors.night-ink}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  search-field:
    backgroundColor: "{colors.channel-well}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.control}"
    padding: "0 14px 0 40px"
    height: "44px"
  form-field:
    backgroundColor: "{colors.field-white}"
    textColor: "{colors.tag-ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  panel-plate:
    backgroundColor: "{colors.tag-plate}"
    textColor: "{colors.tag-ink}"
    rounded: "{rounded.tag}"
    padding: "18px 20px"
  count-box:
    backgroundColor: "{colors.envelope-kraft}"
    typography: "{typography.ops-figure}"
    padding: "6px 12px 8px"
  ops-button:
    typography: "{typography.ops-body}"
    rounded: "{rounded.ops-control}"
    padding: "0 16px"
    height: "36px"
  ops-input:
    typography: "{typography.ops-body}"
    rounded: "{rounded.ops-control}"
    padding: "0 12px"
    height: "36px"
  nav-link:
    textColor: "{colors.night-ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  nav-link-current:
    textColor: "{colors.night-ink}"
  ops-tab:
    typography: "{typography.ops-body}"
    padding: "0 12px"
    height: "36px"
  ops-table-row:
    typography: "{typography.ops-body}"
    padding: "8px 12px"
    height: "36px"
---

# Design System: Openfront Convenience

Two surfaces, one store. The public storefront (`features/storefront`, scoped under `.sf`) is a dark shelf edge; the operator pages (`features/platform`) sit inside the fixed shared dashboard shell and use its neutrals, adding only the safe-drop envelope's ruled count boxes and red pencil. The shared shell itself is out of scope and is not described here.

## Overview

**Creative North Star: "The Shelf Edge at Night" (storefront) / "The Shift Log and the Safe-Drop Envelope" (platform)**

The storefront is the black plastic channel strip that runs along every shelf in the store. The page ground is charcoal, tinted a few degrees toward the store's logo hue. Every item is a white tag plate clipped to that channel: price big, size small. Aisles are logo-hue plates hung on two wires. Prices and signs are set in condensed shelf-tag type, and nothing is decorated beyond tags and signs. An item with no price still gets a designed unlit tag. It is never left blank.

The platform is the store's counted-money paperwork. Each page leads with ruled figure boxes (expected, counted, over or short) on a pale kraft tint, followed by a dense hairline queue of whatever is short, open or unconfirmed. Entry forms sit behind it. Figures, register, till and pack numbers are in mono. Red pencil appears only where a figure is short or critical.

Both surfaces are dense, flat and squared-off. Depth on the storefront is physical (tags a hair proud of the channel, signs hanging lower). The platform has no depth beyond the shell's own.

**Key Characteristics:**
- Storefront: charcoal channel ground that follows the logo hue (`--sf-h`, default 44), never grey-washed.
- White tag plates for every item, receipt, rewards panel and the hours board.
- Barlow Condensed 700 for prices, signs and titles; Barlow for text; tabular figures wherever money appears.
- Platform: shell neutrals, kraft count boxes with a 1px ink rule, Geist Mono figures, underline tabs, 36px hairline table rows.
- Corners: 2px tags, 3px storefront controls, 4px platform controls, 6px platform panels. No pills.

## Colors

The storefront palette is a night channel, white plates and one chromatic voice (the logo hue). The platform palette is the shell's neutrals plus three ledger inks.

### Primary
- **Aisle-Sign Hue** (`aisle-sign`, hover `aisle-sign-hi`): aisle signs, aisle plates on shelf heads, the aisle number chip in titles and the back link, the one filled action per screen, text selection, and the 7px "Made in store" mark. The hue is rotated live from the store's logo colour (`(260 + logoHue) % 360`). The frontmatter values show the default hue of 44.
- **Red Pencil** (`red-pencil`): platform only. A short (negative) variance or a critical metric in a count box. In dark mode it falls back to the shell's red-400.

### Secondary
- **Green Ink** (`green-ink`): platform only. A variance that balances to exactly zero.

### Neutral
- **Channel Ground** (`channel-ground`): the storefront page floor.
- **Channel Strip** (`channel-strip`) with **Lip** (`channel-lip`) and **Floor** (`channel-floor`): the top channel, footer, phone menu sheet, the channel behind each shelf row and behind the product's size tags. The lip is a 2px inset highlight on top and the floor a 1px inset shadow below.
- **Well** (`channel-well`): search fields and the photo backing on dark ground.
- **Line** (`channel-line`): hairlines, control strokes and link underlines on dark ground. On plates it is replaced by **Tag Rule** (`tag-rule`).
- **Night Ink 1/2/3** (`night-ink`, `night-ink-2`, `night-ink-3`): primary, secondary and tertiary text on the dark ground.
- **Tag Plate** (`tag-plate`) with **Tag Ink** (`tag-ink`, `tag-ink-2`): every white plate and the text printed on it.
- **Unlit Tag** (`tag-unlit`): the plate for an item with no price on file.
- **Hanger Wire** (`hanger-wire`): the sign wires and the outline of the "All aisles" sign.
- **Focus Ring** (`focus-ring`): focus outlines, caret and the active phone-menu link on dark ground.
- **Envelope Kraft** (`envelope-kraft`): platform count-box cells in light mode only. Dark mode uses the shell's muted at 30%.
- **Status lamps** (`lamp-open`, `lamp-warn`, `lamp-danger`, `lamp-off`): the 8px lamp on dark ground. On plates they shift darker (open 58%, warn 64%, danger 55%) so they still read.
- **Alert** (`alert-ground`, `alert-ink`): the storefront error strip.
- **Field White / Field Rule** (`field-white`, `field-rule`): sign-in and sign-up inputs, which sit on a white plate.

### Named Rules
**The Logo Hue Rule.** Every chromatic storefront value derives its hue from `--sf-h`. No fixed brand colour is ever written into storefront CSS, apart from the reserved deal pair (hue 95/27) and the state lamps.

**The Earned Yellow Rule.** Deal-yellow plates with red digits are declared (`--sf-deal`, `--sf-deal-digits`) but draw only where the data marks an item as a deal. The public catalog carries no such field today, so none are drawn, and none may be faked.

**The Red Pencil Rule.** On the platform, red pencil appears only on short or negative figures and critical metrics. Green ink appears only on a variance that balances to zero. An over (positive) variance stays in ordinary ink.

**The Kraft Envelope Rule.** The kraft tint sits only behind count boxes. It never washes a panel, table or page.

## Typography

**Display Font:** Barlow Condensed 600/700 (with Arial Narrow, sans-serif), loaded as `--sf-tagface`
**Body Font:** Barlow 400–700 (with ui-sans-serif, system-ui), loaded as `--sf-text`
**Platform:** Geist and Geist Mono, inherited from the shared shell

**Character:** The storefront type is shelf-tag printing: tall, narrow, heavy figures next to a plain grotesque that does the reading. The platform type is ledger handwriting set in Geist: small, even UI sizes, with every number in mono.

### Hierarchy
- **Headline** (Barlow Condensed 700, `clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem)`, 0.95): shop and account page titles, prefixed with the aisle number chip when an aisle is selected.
- **Headline Product** (700, `clamp(2rem, 1.5rem + 2vw, 3rem)`, 1): the product title.
- **Price Hero** (700, 3.5rem; 3rem on phone): the single-size product price.
- **Price** (700, 2.25rem; 2rem on phone, 0.92, tabular): every shelf-tag price. The currency symbol is 0.5em and the cents 0.52em, both raised to the top of the units. "From" is set in Barlow 0.75rem at the baseline.
- **Sign** (700, 1.25rem, 1.1): aisle sign names, aisle plates, the phone-menu links and the "Ask at counter" tag.
- **Title** (700, 1.5rem): store name, hours-board title, fuel prices, profile name, receipt totals. The 2.5rem figure step is used for rewards balances.
- **Body** (Barlow 400, 1rem, 1.5): running text. Product descriptions are capped at 65ch.
- **Label** (Barlow 600, 0.875rem): tag names (two-line clamp), field labels, the channel line, the today line.
- **Tag Size** (Barlow 500, 0.75rem): the size or unit under a price, fuel grade, stock and "Made in store" marks.
- **Platform**: page title 24px/600 tight; count-box figure 20px Geist Mono 500 tabular; section title 14px/600 over a 15% foreground rule; table, controls and body 13px; labels, table heads and count-box labels 12px.

### Named Rules
**The Printed Figure Rule.** On the storefront, money is always set in Barlow Condensed 700 with tabular figures. On the platform, money, quantities, and register, till, pack and PO numbers are always Geist Mono tabular. Right-aligned table cells are mono by default.

**The No Letterspaced Caps Rule.** Neither surface sets running labels in tracked uppercase. Storefront tracking is limited to small negative values on large condensed type. Mono uppercase is used only for literal codes such as ISO currency.

## Layout

The storefront wraps content at 1360px with a fluid gutter (`clamp(16px, 2.6vw, 36px)`). The top channel is a single row (min 68px): logo, today line, search (max 420px), nav. It wraps under 1080px. On the home page a second channel row carries address, phone and fuel tags. Shelves are one grid (`auto-fill, minmax(10.5rem, 1fr)`, no column gap, 26px row gap) across the full content width. Each item spans two subgrid rows, photo then tag, so every tag in a row sits on one continuous channel; the last item's channel runs on to the shelf's end, so empty trailing slots read as bare channel. On home the hours board takes a 280–340px column beside the shelves from 1100px, and its own full-width row below that. Aisle signs wrap with an 18px by 12px gap and 16px of headroom for the wires.

Under 760px the nav and header search move into a `<details>` sheet. The today line drops to its own row. The channel strip and the aisle signs scroll sideways with snap and bleed to the screen edge. Shelves go to two columns and prices step down. The product page goes from a 0.9fr/1.1fr split to one column. Account content is capped at 760px, receipts at 560px and auth at 460px.

The platform uses the shell's `PageContainer` with 16/24px side padding and 24px vertical rhythm. Each page shows a title line (with a lamp and the store label), then the count-box strip, the needs-you queue table, underline tabs and the ledger. Count boxes run two up and then auto-fit at a 9rem minimum. Panels sit two up from xl. Table columns marked priority 2 hide under md and priority 3 under lg. Phones get extra bottom room for the floating assistant.

## Elevation & Depth

On the storefront, depth is literal shelf hardware. Tags sit a hair proud of the channel, signs hang lower, and channels are recessed with an inset lip highlight and floor shadow. All shadows are soft and black. There are no offset or coloured shadows. The platform is flat: hairline borders and the shell's surfaces only.

### Shadow Vocabulary
- **Tag** (`box-shadow: 0 2px 3px oklch(0% 0 0 / 0.5)`): every tag plate, fuel tag, panel and hours board at rest.
- **Lift** (`box-shadow: 0 6px 10px -2px oklch(0% 0 0 / 0.5)`): a tag or receipt panel on hover, with a 2px rise.
- **Hang** (`box-shadow: 0 8px 14px -8px oklch(0% 0 0 / 0.8)`): aisle signs.
- **Channel edge** (`box-shadow: inset 0 2px 0 <lip>, inset 0 -1px 0 <floor>`): the channel behind each shelf row and behind the size tags.
- **Top strip** (`box-shadow: inset 0 -1px 0 <lip>, 0 6px 14px -8px oklch(0% 0 0 / 0.8)`): the header channel. The footer uses only the inset top lip.

### Named Rules
**The Hardware Depth Rule.** A shadow on the storefront always stands for a physical relationship (clipped, lifted, hung, recessed). Nothing glows, and no card floats for decoration.

## Shapes

Corners are nearly square throughout. Storefront tags, signs, plates, panels and the hours board use 2px. Storefront controls (buttons, search, fields, nav links, pager, the account switch) use 3px. The active nav link drops to 0 with a 2px logo-hue underline. The only round shape is the 8px status lamp, which reads as a lamp. Platform controls use 4px and panels, tables and list bands use 6px. The platform status dot is an 8px square with a 1px radius. Count boxes are square ruled cells: a 1px ink border at 70% foreground, with a dashed 25% label line under each label.

**The Six Pixel Ceiling Rule.** No corner on either surface exceeds 6px. Pills and capsule tabs are not used.

## Components

### Buttons
- **Shape:** squared (3px storefront, 4px platform).
- **Storefront primary:** filled aisle-sign hue with sign ink, 48px tall (52px beside the home search line), 22px side padding, weight 700. Hover goes to `aisle-sign-hi`. Pressed moves down 1px. Only one filled action per screen.
- **Storefront quiet:** transparent, with a 1.5px stroke of currentColor at 38% that goes to full currentColor on hover.
- **Platform primary:** shell foreground fill with background text, 36px tall (44px on phone), 13px semibold. Hover is the foreground at 85%.
- **Platform secondary / danger:** 1px input border on the background, hover muted. The danger variant uses a destructive border at 40% and destructive text.

### Tag Plate (signature)
The storefront's unit of content. A white plate (2px corners, tag shadow, padding 9/10/10) holds the item name (two lines at most), then a row with the price on the left and the size on the right. An optional rule-topped "Made in store" mark carries a 7px logo-hue square. Hover lifts it 2px and underlines the name. With no priced variant, the plate switches to the unlit tone and prints "Ask at counter" in sign type. The same plate holds fuel prices (min 84px), product sizes (150–220px, on a channel), the hours board, rewards panels, receipts and auth forms.

### Aisle Signs (signature)
A logo-hue plate, 52px tall, hung on two 1.5px wires 16px tall. A sign-ink number chip (40px square) sits before a condensed name. Hover brightens the sign and, when motion is allowed, rotates it -1.5deg around a pivot above the wires. This is the storefront's one authored motion (320ms, `cubic-bezier(0.23, 1, 0.32, 1)`). The current aisle inverts to a sign-ink plate with a 2px hue inset. "All aisles" is an outlined sign with no number. Aisle numbers follow category order on every page and repeat in shelf heads and the back link.

### Inputs / Fields
- **Search:** well background, 1px line stroke, 3px corners, 44px tall (52px on the home search line), with a leading icon in ink-3. Focus changes the border to the focus ring.
- **Account fields:** white field on a white plate with a 1.5px field-rule stroke, 48px tall. Focus changes the border and caret to the sign hue.
- **Platform:** 36px (44px on phone) with a 4px input border. Focus gives a ring border plus a 3px ring at 25%.

### Navigation
- **Storefront:** 44px nav links in ink-2, weight 600, going to ink on hover. The current link takes a 2px logo-hue underline. The phone menu is a `<details>` sheet in the channel colour, with 48px condensed links on hairlines, dropping in over 220ms.
- **Platform tabs:** underline tabs on a hairline track. Each is 36px, 13px medium, muted, with a 2px foreground underline when active. Radio choices use the same underline track.

### Count Boxes (signature, platform)
A `<dl>` grid of ruled cells (1px ink border at 70%, kraft tint in light mode). Each cell has a 12px muted label over a dashed rule, a 20px mono figure, and an optional 12px note. Variance figures are red pencil when short and green ink when balanced. `MetricsBand` renders every page's metrics as count boxes, and critical non-zero metrics are written in red pencil.

### Data Table (platform)
A 6px bordered panel that scrolls horizontally. The sticky 36px head is 12px muted on muted/60. Rows are 36px, 13px, with hairline separators and a muted/40 hover. Right-aligned cells are mono tabular. Status shows as a square dot plus a sentence-case label.

## Do's and Don'ts

### Do:
- **Do** draw every storefront item, price, receipt and account panel as a white tag plate (2px corners, tag shadow) on the charcoal channel.
- **Do** derive every storefront hue from `--sf-h` so the store's logo colour sets the sign and action colour.
- **Do** print an item with no price as the unlit "Ask at counter" tag.
- **Do** set storefront money in Barlow Condensed 700 tabular with raised cents, and platform figures and record numbers in Geist Mono tabular.
- **Do** lead platform pages with count boxes and a queue table, and put entry forms behind a primary action or below the ledger.
- **Do** keep the sign sway behind `prefers-reduced-motion: no-preference` and fine-pointer hover.

### Don't:
- **Don't** use corners above 6px, pills, or capsule tabs on either surface.
- **Don't** put a grey or washed-out ground or a generic floating card on the storefront. Dark ground and white plates only.
- **Don't** draw deal-yellow tags or red price digits unless the data marks the item as a deal.
- **Don't** use red pencil on the platform for anything except short, negative or critical figures, and don't spread the kraft tint beyond count boxes.
- **Don't** imply online payment or ordering in any storefront control.
- **Don't** add offset, coloured or glowing shadows. Storefront shadows are soft black hardware shadows, and the platform is flat.
