# Impeccable critique: Convenience, before (2026-10-25)

Run as two isolated sub-agents: Assessment A (design review) and Assessment B (detector plus greps). The browser overlay was skipped because the demo needs a login.

## Detector (B)
- **Both runs exited 0.**
- **Platform:** 20 advisory font-size findings, not on the ramp (11px ×11, 15px ×5, 13px ×3, 10px ×1).
- **Storefront:** 13 advisory font-size findings in `shop.css`.
- **No slop rules fired.**
- **Grep totals:**
  - Platform: `rounded-full` 13, `rounded-lg/xl/2xl` 34, `shadow-[inset` 9.
  - Storefront radii are clean: `--sf-r` is 3px.

## Design review (A)
- **Specificity:** the platform is generic. Each page is a title, a 4-up metric grid, a pill tab track, then rounded form cards. There are no tables in features/platform. Pages lead with blank entry forms, not with the state of the store.
- **Storefront:** the receipt idea is distinctive but the store doesn't read as real. There are no fuel prices, deals, services or photos, and every product says "Ask in store".
- **Heuristic scores:**

  | Heuristic | Score |
  |---|---|
  | Visibility | 1 |
  | Consistency | 1 |
  | Flexibility | 1 |
  | Help | 1 |
  | Recognition | 2 |
  | Minimal design | 2 |

- **Priority issues:**
  1. The `cv-ui` kit is pills and rounding by design:
     - `trackClass`, `pillClass`, buttons, `panelClass`, `wellClass` and `ListBand` are rounded-full or 2xl;
     - `inputClass` is rounded-lg;
     - `ListBand` is used 69 times.
  2. No data tables.
  3. Pages lead with forms, not state.
  4. Status meaning is wrong:
     - "open" maps to warn;
     - Reorder and Low contradict each other;
     - negative on-hand is not shown as danger.
  5. Empty prerequisites aren't surfaced. For example, fuel with 0 sites still shows 3 forms.
- **First-10-second tasks:**

  | Page | Operator's first task |
  |---|---|
  | Overview | What needs me now |
  | POS | Scan an item |
  | Tills | Open drawers: expected vs counted |
  | Fuel | Pump status, posted prices, unconfirmed dispenses |
  | Lottery | Active packs per bin, sold vs cash |
  | Money services | Today's transactions and pending settlement |
  | Inventory and stock | Negative, low or expiring items |
  | Purchase orders | What to receive |
  | Reconciliation | Variance by till and tender |
  | Exceptions | Open queue by severity |

## Storefront
1. It doesn't read as a convenience store.
2. "Ask in store" is repeated on every product.
3. /shop is alphabetical, not grouped by aisle.
4. Store-card details repeat, and on phone the catalog sits below the fold.
5. Every section uses the same slab treatment.
