# Rich demo data for CartPOS Demo org — design

Date: 2026-06-19
Branch: feat/business-type-customization
Status: approved (brainstorming), pending spec review

## Goal
Turn the thin `CartPOS Demo` fixture (4 shops, ~6 products + 2 sales each) into a rich,
realistic, feature-complete demo that (a) showcases **every business type the POS can serve**
and (b) exercises **every function/field** in the data model — so a prospect can log in and see
the product working like a real shop, and so we QA every feature in the live app.

## Decisions (locked with user)
- **Target:** the existing `CartPOS Demo` org (`isDemo=true`, id `cmq8k1vxn0000fc18qfv6x3ic`) in
  **production** — strictly scoped to that org. The reset script is hard-guarded to `isDemo=true`
  and never touches other orgs.
- **Shops:** one per supported `OrganizationType` — **22 shops** (full breadth).
- **Depth:** exhaustive — every entity/field/enum value represented.
- **Volume:** large, dated across the **last ~90 days** from 2026-06-19.
- **Method:** **hybrid** — a rewritten seed script creates the bulk + 90-day history (UI cannot
  backdate `createdAt`); then a Playwright pass verifies rendering and exercises live flows.
- **Blocked-ops UI testing:** use `scripts/toggle-demo-lock.ts off/on` to test
  void/return/quotation/edit live in the demo org, then `reset-demo-org` to restore.

## The 22 verticals and their feature profiles
`ShopSettings` flags are per-shop, seeded via `presetShopSettingsData(verticalType)` even though
the org itself is `GENERAL_STORE`. Profiles (from `lib/domain/business-presets.ts`):

| Profile | Flags on | Types (shops) |
|---|---|---|
| A. Lean retail | none | KIRYANA_STORE, GENERAL_STORE, RETAIL_STORE, SUPERMARKET, CONVENIENCE_STORE |
| B. Quote + trade pricing | quotations, tradePrice | HARDWARE_STORE, SANITARY_STORE, ELECTRONICS_STORE, AUTO_PARTS, FURNITURE_STORE, WHOLESALE |
| C. Pharmacy | unit splitting + batch/expiry | PHARMACY |
| D. Restaurant | service + delivery charge | RESTAURANT |
| E. Specialty retail | none (distinct goods) | MOBILE_ACCESSORIES, CLOTHING_STORE, FOOTWEAR_STORE, COSMETICS_STORE, JEWELRY_STORE, OPTICAL_STORE, STATIONERY_STORE, BAKERY |

Plus OTHER (generic). Each shop gets a realistic, trade-appropriate product catalog and a Pakistani
city. Names follow the forced-UPPERCASE convention (intentional).

## Artifact 1 — rewrite `scripts/seed-demo-org.ts` (data-driven generator)
Keep the public API (`seedDemoOrg`, `DEMO_ORG_NAME`, `DEMO_USERS`, `DEMO_PASSWORD`) and idempotency
(skip if a demo org exists). Replace the inner data with:

- **`VERTICALS[]`** — 22 entries: `{ type, shopName, city, profile, catalog[] }`.
  - `catalog[]` items carry the full Product surface where relevant: `name, sku?, barcode?, unit,
    price, costPrice, tradePrice?, category, reorderLevel?, cartonSize?, cartonPrice?, cartonBarcode?,
    archived?`, plus optional `packagingLevels[]` (pharmacy) and `lots[]` (pharmacy batch/expiry,
    electronics serial/IMEI).
- **`seedShop()`** per vertical:
  - Create shop + `ShopSettings` from `presetShopSettingsData(type)`.
  - Create products; opening stock via `StockLedger` PURCHASE; create `PackagingLevel` and `StockLot`
    rows where defined (incl. near-expiry and expired lots for the expiry-alert report).
  - 2–3 suppliers with `SupplierLedger`: OPENING_BALANCE, PURCHASE_CREDIT, PAYMENT_MADE (CASH/CARD),
    ADJUSTMENT; plus `Purchase` + `PurchaseLine` records over time.
  - 8–20 customers (walk-in + named); some with udhaar opening balances (`CustomerLedger` ADJUSTMENT).
- **`simulate90Days(shop, flags)`** — generic, deterministic (seeded mulberry32 PRNG; vary seed by
  shop index). Backfills `createdAt`/`date` explicitly across the last 90 days. Produces, gated by flags:
  - Invoices: PAID (CASH / CARD / OTHER) + UDHAAR + **PARTIAL** + a few **VOID**; with discounts;
    restaurant invoices carry `serviceCharge` + `deliveryCharge`. Each with `InvoiceLine[]` and a
    matching `StockLedger` SALE per line.
  - Payments: invoice payments + standalone udhaar cash receipts (cash-in) with `CustomerLedger`.
  - **SaleReturns**: REFUND (CASH and ACCOUNT_CREDIT) + EXCHANGE (replacement line); `restocked`
    true/false (damaged); `StockLedger` RETURN entries for restocked qty.
  - **Quotations** (quote-enabled shops only): OPEN, CANCELLED, and CONVERTED (with a linked invoice
    + `convertedInvoiceId`/`convertedAt`).
  - Expenses across many categories (Utilities, Rent, Salaries, Transport, Supplies, Marketing, Misc).
  - Stock movements covering all 7 `StockMoveType`s: PURCHASE, SALE, ADJUSTMENT, DAMAGE, EXPIRY,
    RETURN, SELF_USE.
- Users unchanged: admin (ORG_ADMIN), manager (STORE_MANAGER on all shops), cashier (CASHIER on 1–2).

Volume targets (per shop, averages): ~20 products, ~12 customers, ~3 suppliers, ~50–70 invoices over
90 days, ~15 expenses, ~3 returns, ~4 quotations (quote shops). ~22 shops total.

## Artifact 2 — fix `scripts/reset-demo-org.ts`
The current reset predates pharmacy/returns/quotations and would FK-fail on the new data. Add
`deleteMany` for the new entities, in FK-safe order **before** their parents:
`SaleReturnLine` → `SaleReturn`; `QuotationLine` → `Quotation`; `StockLot`; `PackagingLevel`
(all scoped to the demo org's shops; same `isDemo` hard-guard preserved).

## Artifact 3 — Playwright verification + live-function pass
After `prisma generate`, **restart `npm run dev`** (server caches the Prisma client), then:
1. Login `demo.manager@cartpos.app` / `Demo@12345`. For each profile's representative shop, verify:
   POS renders + search; Products list (categories, archived hidden); Reports (sales/profit/charts
   populated over 90 days); Cash Book reconciles; Customers + statement (udhaar balances); Suppliers +
   payables statement; Quotations list (quote shops); Expiry alerts (pharmacy); restaurant
   service/delivery charge on a receipt.
2. Exercise **allowed** live flows: ring a CASH sale with discount + card fee; add a product; add a
   customer; record an udhaar payment.
3. **Blocked ops** (void/return/quotation/edit): `toggle-demo-lock off` → re-login → test each live →
   `toggle-demo-lock on` → re-login → `reset-demo-org` to restore the pristine rich baseline.

## Out of scope
- No schema/migration changes (only seed + reset scripts + a Playwright pass).
- No changes to receipt/print markup (hand-tuned; do not touch).
- No new product features — this is data + verification only.

## Docs to update on completion (mandatory)
- `docs/TESTING_LOG.md` — the "PERMANENT DEMO / TEST ORG" section: now 22 shops, rich 90-day data;
  log the Playwright verification results.
- `docs/MULTI_VERTICAL_PLAN.md` — Phase 4 "demo data" item: done.

## Risks / mitigations
- **Prod writes:** only via `reset-demo-org` (hard-guarded `isDemo`) and Playwright in the demo org;
  never other orgs. User runs the reset.
- **Pooled prod connection:** large insert volume — batch with `createMany` where possible; chunk if slow.
- **Re-lock discipline:** always `toggle-demo-lock on` after destructive testing; reset restores baseline.
