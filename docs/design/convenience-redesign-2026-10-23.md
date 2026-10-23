# Openfront Convenience: storefront and platform direction (2026-10-23)

## Who comes first
- **Customer:** someone near the store who wants to know if it's open, where it is, and whether it has the thing: snacks, drinks, a hot item made in store. They browse by aisle and buy a few items fast.
- **Merchant:** a store manager whose day is the register: open the till, ring sales, handle refunds and voids, then close the day. Fuel, lottery and money services sit beside that.

## Direction: "shelf tag"
Convenience-store signage, not a template. Names are set in an expanded heavy grotesk like a store sign. Prices are set like shelf tags: big condensed units with the currency mark and cents raised. The ground is warm paper; one shelf-edge colour comes from the store's logo hue.

### Type (Google Fonts, OFL)
- **Archivo** (variable width): display at `font-stretch: 112–118%`, weight 800; body at 100%; prices at 78%.
- **JetBrains Mono**: phone numbers, hours, receipt numbers, totals on the receipt tape.

### Colour
`--sf-h` = (260 + saved logo hue rotation) mod 360, the same hue the public projection derives brand colours from.
- `--sf-edge`: `oklch(57% 0.2 h)`: shelf edge, basket count, primary storefront action
- `--sf-deep`: `oklch(27% 0.06 h)`: header strip, aisle signs, footer
- `--sf-tint`: `oklch(95.5% 0.03 h)`: product tag art, today's hours row
- Paper ground, white surface, recessed well; there's a dark scheme under `prefers-color-scheme`.

Default mark: Untitled UI **Boltshift** (registry), rotated 144° from its blue to a convenience-store red. The previous default was a custom path that wasn't in the registry.

### Shared rules
- Raised pill in a recessed track for every in-page switch (categories, options, account tabs, platform task tabs, pagination) and for buttons.
- Status dots on the title line: today's hours, order status, checkout steps, platform page state, activity rows.
- Copy is labels, states and errors only.

## Storefront
- **Shell:** a header strip (today's hours with a dot, address, phone), a sticky bar (logo lockup, search, Shop and Account pills, basket pill with count). On phone, the bar holds the logo, the basket and a menu sheet with search. The footer has the location, the hours with today highlighted, and links. There's a coming-soon state.
- **Home:** the store name as signage, the tagline, Shop and Aisles actions. A store card with the shelf edge shows the title-line hours, address, phone, weekly hours and directions. Numbered aisle signs (one per category) list items, with a "Made in store" chip for prepared food.
- **Shop:** the title (or category) with a count, search, a category track and shelf-tag cards (2-up on phone). Pagination is a track.
- **Product:** large tag art with the price, title, description, options as raised choices with prices, quantity and Add to basket.
- **Basket:** a list band with a quantity pill and remove control per line, a receipt-tape total and a sticky Checkout bar on phone.
- **Checkout:** Account and Payment steps with title-line states (payment shows "Online payment unavailable"), and a receipt-tape summary.
- **Account:** profile or sign-in, and orders as a list band with the status on the title line. Sign in / Create account pages are a track plus a form card.

## Platform
The kit is `features/platform/components/cv-ui.tsx` plus `Workbench.tsx`, inside the unchanged shared shell.
- **Page header:** the title, with a dot and the store name on the same line (amber when a metric needs attention). Scope switchers are tracks. The metrics band shows the projection's `metrics` (they weren't rendered before) in mono.
- **Workbench:** each page's forms are grouped into task tabs, with the primary job first. The chosen tab is kept per page for the session, so it reopens after a post redirects back.
  - POS: Checkout (register, then receipt-tape basket) · Basket and tender · Corrections · Till and shift · Refunds and voids · Receipts · Offline queue
  - Fuel: Pump sales · Prices · Tanks and deliveries · Wet stock · Setup
  - Inventory: Stock · Counts · Transfers · Adjustments
  - Purchasing: Receive · Orders · Vendors
  - Pricing: Prices · Promotions · Catalog items · Tax
  - Foodservice: Prep · Waste · Recipes
  - Lottery: Ticket sales · Packs · Settlement · Games
  - Money services: Transactions · Settlement · Provider
  - Loyalty: Members · Program
  - Payments: Settlements · Providers
  - Reconciliation: Close the day · Bank deposit
  - Exceptions: Queue · Evaluate
  - Exports: Batches · Destination
  - Restricted sales: ID checks · Policy
  - Recovery: Offline replay · Devices · Machine keys
- **Lookups:** one `LookupForm`, which keeps the page's other search values as before.
- **Activity:** a list band with the status dot on the title line. Cents read as amounts.
- **Overview:** the metrics, a Today shortcut well, and store days.
- **Store settings:** Brand / Location / Hours sections, Draft–Published as a segmented control, a preview card, and the publication state on the title line.
- **Reports, receipt (print-friendly till tape), onboarding:** restyled with the kit.
