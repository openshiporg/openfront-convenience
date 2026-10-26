---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: []
---

# Surface: convenience platform pages (`features/platform/**`)

Mode: Operate. Users: store manager, cashier lead, closing shift. Job: see what is wrong tonight (drawer variances, open exceptions, negative or low stock, unclosed day, unconfirmed fuel dispenses, packs to settle) and act on it; ring a sale fast on POS. Constraints: shared dashboard shell fixed and byte-identical to E-commerce; owner bans pill or heavily rounded tabs, chips and cards (radii ≤6px, flat or underline tabs, dense tables, real status columns). Inferred without interview (owner ordered no approval stage).

## Direction contract
THESIS: The shift log and the safe-drop envelope. A store runs on counted money written into ruled boxes: expected, counted, over/short, initialled; every page leads with the state of the store as those ruled figure boxes and a queue of what is short, open or unconfirmed, instead of the category default of four zero-valued metric cards over a pill track and blank entry forms.
OWN-WORLD: Shell neutrals, carbon ink, envelope kraft tint (oklch 0.95 0.03 80) only behind count boxes, red pencil oklch(0.52 0.19 27) only for short/negative, green ink for balanced; Geist UI at 12/13/14/20/24px, Geist Mono tabular for money, quantities, register and pack numbers. 4px controls, 6px panels, underline tabs, hairline tables with sticky headers; count boxes are ruled cells with a 1px ink border and a label line.
STORY: The manager opens a page, reads the store's state in ruled count boxes (expected / counted / variance), works the queue of what is short or open from its rows, and opens the entry form only when needed (forms sit behind a primary action or below the ledger).
FIRST VIEWPORT: Title and one primary action; the count-box strip (the page's own expected/counted/variance or equivalent); the "needs you" queue as a table; then underline tabs and the full ledger table; entry forms collapse into a disclosure or a side panel beneath.
FORM: candidate 6 of 7 (shift log and safe-drop envelope), seed:2287d689c2e15d19. Raises: from ikeda-datamatics, density courage (36px rows, tables over cards); from brand-identity-canon-saville-catalog-sleeve, every record shows its number (register, till, pack, PO numbers in mono on every row); from crouwel-grid-specimen, figures built on one visible grid (count boxes align to the table's columns). Declined: notation-diagram-systems-orienteering-map, rw-manual-acetate-tab-board, pop-culture-shelf-vertical-video-feed-surface.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
