# Convenience (Cedar & Main Market): full redesign of platform pages and storefront (2026-10-25)

- **Brief:** `~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`
- **Live:** https://openfront-convenience-production.up.railway.app (convenience.openship.org once DNS is in).

This is a redesign, not a polish. Two things were treated as evidence and replaced: the "night receipt" storefront from earlier on 2026-10-25, and the recessed-pill platform kit. The owner's 2026-10-24 pin (dark, premium, no grey washed-out grounds) still binds the storefront. The shared dashboard shell is byte-identical to E-commerce (parity drift 0).

## Process (impeccable)
- **Context.** `impeccable context` ran, and the existing PRODUCT.md was kept. The owner ordered no approval stage, so no interview was held.
- **Critique.** Two isolated sub-agents; the synthesis is in `CRITIQUE.md`. Findings:
  - The kit was pills by design, with `ListBand` repeated 69 times.
  - There were no tables anywhere.
  - Pages led with blank entry forms.
  - An open till showed as a warning.
  - The storefront read as a text file, not a store.
- **Direction rolls (`concept-seed`):**
  - Platform (Operate): candidate 6 of 7, the shift log and safe-drop envelope. Seed `2287d689c2e15d19`.
  - Storefront (Persuade): candidate 4 of 7, the shelf-edge price tags. Seed `448b8fc8e573d100`. It is rendered dark to honour the owner's pin, as the black shelf channel with white tags.
  - Contracts, with challenger verdicts and donated raises, are in `.impeccable/surfaces/`.
- **Build.** I rewrote the kit (`cv-ui.tsx` with `CountBoxes` and `DataTable`) and the page shells myself. Four platform agents and one storefront agent then worked in disjoint directories.
- **Gates:**
  - `tsc --noEmit`: exit 0. The first run caught 6 type errors in lottery and money services, which I fixed.
  - Unit tests: 33/33.
  - Parity: drift 0.
  - `impeccable detect`: `[]` once DESIGN.md described the new world.
- **Finish review.** A fresh `impeccable-finish-reviewer` ran.
  - It first asked for a recapture: the home page overflowed at 390px. That was a real bug, an implicit grid column, now `minmax(0, 1fr)`.
  - The full review then returned **fix** with 8 items. I applied them, deployed and recaptured.
  - The verdict pass scored **6 resolved, 1 partial (Fuel boxes), 1 unresolved (exact column alignment)**, with 2 regressions.
  - The final batch fixed Fuel and both regressions: the orphan over/short box on phone, and a sentence set in mono.
- **Documentation.** `impeccable-documenter` replaced DESIGN.md and `.impeccable/design.json`, which had still described the night receipt.

## Platform: the shift log and the safe-drop envelope
- **Count boxes.** Every page opens on the store's state as **ruled count boxes**: kraft-tinted cells with a dashed label line, expected / counted / over-short. Short figures are in red pencil and balanced ones in green.
- **Queue, then ledger.** Next comes a "needs you" queue table, then the full ledger table under underline tabs.
- **Forms** sit behind their primary action.
- **Missing prerequisites** say what to set up instead of rendering forms full of "None available".

| Page | Leads with |
|---|---|
| Overview | "Needs you tonight": short drawers, critical exceptions, negative stock, unclosed days, unconfirmed fuel, packs to settle. Live, it surfaces the two items at -1 on hand. |
| POS | The scan field first, with a compact basket/till/cashier row and a big mono total |
| Tills | Drawers open, opening floats, expected, counted, over/short, then a table: Register, Cashier, Opened, Sales, Expected, Counted, Variance, Status. An open drawer reads as normal. |
| Reconciliation | The envelope: expected $15,007.92 from the open till, counted and over/short pending. Then variance by till, short first, and the store-day and deposit ledgers. |
| Exceptions | The open queue by severity; own or resolve opens inline on the row |
| Fuel | Pumps, tanks and posted prices, then unconfirmed dispenses as paid vs dispensed. "No fuel site set up" offers setup, not forms. |
| Lottery | Missing setup with fixes, sold vs cash, short packs, settlements |
| Money services | Missing setup with fixes, sold vs cash, short packs, settlements |
| Inventory and stock | One vocabulary (Negative / Reorder / Low / OK); negative is danger |
| Purchase orders | "To receive today" |
| Foodservice | "Make or discard now" |
| Restricted sales | Open incidents, then failed ID checks |
| Sales, payments, exports, reports, customers, staff, store settings | Queues where the data supports one, then tables with status columns |

## Storefront: the shelf edge at night
- **Ground and tags.**
  - A charcoal channel ground tinted toward the logo hue, never grey.
  - White price tags on a black shelf rail: price first in Barlow Condensed with raised cents, size second, name.
  - Aisles hang as numbered signs in the logo's own colour.
- **Top channel.** Store name, live open/closed state ("Closed · opens 6am"), today's hours, address with directions, and phone. Fuel price tags appear when prices are posted.
- **Pages.**
  - `/` and `/shop` group shelves by aisle, and the hours sit in their own column.
  - "Ask at counter" appears only where an item has no price.
  - Every route, state and workflow is kept, including coming-soon, the basket and checkout redirects, and the no-online-payment rule.

## Skills used, per screen, and what each changed
- **impeccable.** The whole process above:
  - Operate rules on platform pages (type, palette, density, and the count box as the one signature move).
  - Persuade rules on home (the search and aisles are the working entry).
  - The craft floor, detector, reviewer with recapture and verdict passes, and documenter.
- **design-taste-frontend / frontend-design.**
  - The subject inventories: shelf tags, lottery books, fuel pylon, route invoices, backbar, planogram, safe-drop envelope.
  - The defaults list removed the receipt's dotted leaders, tracked caps and instruction-tail copy.
- **industrial-brutalist-ui.** Density courage (36px ledger rows) and ruled-cell figures. I rejected the uppercase mono.
- **minimalist-ui.** Flat 4px controls; hairlines instead of cards.
- **gpt-taste.** One primary per screen, and no meta labels on the storefront.
- **high-end-visual-design / emil-design-eng.** Restrained, state-only motion, with reduced motion respected. I rejected pill CTAs.
- **color-expert.** The oklch logo-hue derivation for the aisle signs (white text at 7.0:1 measured) and the kraft and red-pencil values.
- **hallmark / creative-director.** Used as the anti-template check across candidates.

## Commits (master, auto-deployed)
- `9378839` Platform redesign: the shift log, store state first, real ledgers
- `d7403b8` Storefront redesign: the shelf edge at night
- `edeb6d0` Design record: direction contracts, critique and before screenshots
- `7586fd5` Storefront: the home aisle row no longer widens the phone page
- `92e5428` Redesign finish-review fixes and design system record
- `d86f152` Platform: verdict-pass fixes

## Screenshots
- Playwright (WebKit), 1440x900 and 390x844, full page, 26 routes each, taken from the live demo.
- Before shots: `before/`. After shots: `after/`.
- A 390px overflow sweep of every captured route finds no page wider than the screen.

## Open
- **Exact column alignment.** The count boxes are edge-aligned with the tables but not column-aligned. This is the contract's Crouwel-grid raise, and the reviewer scored it unresolved. It needs a shared column template, or the owner waiving that line.
- **Deal and fuel tags** are defined but never drawn: the catalog has no deal field, and the demo has no fuel site.
- **Onboarding** files keep their rounded cards; onboarding was off-limits.
- **No third review.** The final batch (Fuel boxes and the two regressions) has not been through a third review. Two rounds is the unattended budget.
