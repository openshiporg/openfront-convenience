# Product

<!-- impeccable:product-schema 1 -->

Inferred from the repository and the owner's redesign brief (`~/Code/Euler/state/briefs/design-skills-redesign-2026-10-25.md`) on 2026-10-25. The owner ordered the work without an approval stage, so no interview took place. Every line below is inferred, not confirmed.

## Platform

web

## Users
- **Customer (storefront):** someone near the store who wants to know whether it's open, where it is, and whether it has the thing they need (snacks, drinks, a hot item made in store), often on a phone and in a hurry. Account holders also check their receipts and rewards points.
- **Merchant (platform):** a store manager running the register, fuel, lottery, money services and the close of day. The platform shell is shared with Openfront E-commerce and isn't in scope for storefront work.

## Product Purpose
Openfront Convenience runs a single neighbourhood convenience store: POS, fuel, inventory, purchasing, foodservice, lottery, money services and loyalty. The public storefront is a catalog and store card. Orders are paid at the counter, so basket and checkout lead back to the shop.

## Positioning
The storefront is a live projection of the store's own operating data: today's open or closed state in the store's timezone, posted fuel prices, aisles that match the store's categories, receipts from real register sales and rewards balances.

## Operating Context
- Customers browse by aisle (category), search the catalog, open a product for sizes and prices, and ask in store when something isn't tracked as in stock.
- Customer accounts: sign in and create an account, receipts list and receipt detail, rewards accounts with point history.
- The store's name, tagline, logo SVG and logo hue come from store settings. The storefront follows the logo hue.

## Capabilities and Constraints
- Routes: `/`, `/shop` (search, category, page), `/shop/[productId]`, `/basket` and `/checkout` (redirect to `/shop`), `/account`, `/account/[mode]` (signin, signup), `/account/receipts/[saleId]`, plus a coming-soon state while unpublished.
- No online payment. The storefront must never imply one.
- Product photos are optional. Many products have none.

## Brand Commitments
- The store's own name, logo SVG and logo hue (hue rotation) are the brand; the storefront uses them.
- Owner direction for this redesign (2026-10-24): dark, considered and premium; no grey, washed-out grounds; no generic SaaS cards; UI copy is labels, states and errors only; phone width must work. Tessier (`~/Code/shops/tessier`) is the reference the owner likes.

## Evidence on Hand
Store settings, categories, products (with optional photos), fuel prices, hours and location come from the live data. There are no testimonials, reviews or press, and none may be invented.

## Product Principles
1. Answer "is it open, where is it, do they have it" first.
2. Show only facts the store's data proves. Never claim online ordering or payment.
3. Every route, state and workflow stays. Presentation changes; behaviour doesn't.
