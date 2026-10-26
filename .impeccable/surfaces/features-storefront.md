---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: []
---

# Storefront (customer) surface brief

Scope: the public storefront: `/`, `/shop`, `/shop/[productId]`, `/account`, `/account/[mode]`, `/account/receipts/[saleId]`, the coming-soon state. Mode: Persuade on `/`; Operate on shop, product and account. Audience and job are in PRODUCT.md. Constraints: every route, state and workflow stays; no online payment claims; owner pinned a dark, premium aesthetic (2026-10-24 brief); owner rejected the 2026-10-25 "night receipt" build as not good enough (2026-10-25 full-redesign brief).

## Direction contract
THESIS: The shelf edge at night. Every convenience store's catalog lives on the black plastic channel strip along each shelf: a white tag per item with the price set big and the size small, yellow tags for deals, the aisle number on a hanging sign; the storefront is that shelf edge, aisles as hanging signs and products as tags, instead of a receipt text file or a hero over a card grid.
OWN-WORLD: A charcoal channel ground (dark, never grey-washed: oklch 0.17 with a few degrees of the logo hue), white tag plates with ink text, deal-yellow tags oklch(0.88 0.17 95) with red price digits only where the data marks a deal, the logo hue as the aisle-sign colour. Barlow Condensed 700 for prices and aisle signs (shelf-tag printing), Barlow for text, tabular figures everywhere money appears. Tags are 2px-corner plates; controls 3px; no pills.
STORY: The visitor sees the store's open state, address and fuel prices on the top channel, picks an aisle from the hanging signs or searches, scans tags (price first, size second), opens an item for sizes and prices, and (signed in) reads receipts and points.
FIRST VIEWPORT: Top channel strip: store name, open/closed state, today's hours, address with directions, phone, fuel prices as tags when posted. Then the search line. Then the aisles as a row of hanging signs (logo-hue plates with aisle numbers) and the first shelf of tags inside the first screen; phone: name and open state, search, aisle signs scroll sideways, first tags.
FORM: candidate 4 of 7 (shelf-edge price tags), seed:448b8fc8e573d100. Raises: from signals-instruments-seven-segment-alarm-clock, unlit segments are designed too (items with no price or stock show a designed "Ask at counter" tag state, not a blank); from brand-identity-canon-fletcher-wit-poster, one idea per section so the craft can relax (no ornament beyond tags and signs); from vernacular-ephemera-boarding-pass-and-gate-board, ordered columns that hold a crowd's gaze (tags align on one shelf grid). Declined: medium-native-ebru-floated-pigment, dream-surreal-impossible-worlds-moon-shadow-bazaar, games-toys-physics-play-brick-build-instructions.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
