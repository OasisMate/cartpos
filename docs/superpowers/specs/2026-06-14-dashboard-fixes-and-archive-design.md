# Store dashboard fixes + product archive — design (2026-06-14)

Reported by Rose Mart owner. Verified against live data (read-only diagnostic).

## A. Gross profit overstated
**Cause:** `reports.ts` `getCostOfGoods` treats products with no cost price as COGS = 0, so their full sale price counts as profit. Live: 52% of this-week revenue has no cost basis.
**Fix:** for lines whose product has no/zero cost price, add `lineTotal` to COGS (cost = sale price) so the line contributes **0 profit**. Apply same in `getReturnsAdjustment`. Margin then reflects only items with a known cost.

## B. "Top products" quantities wrong + mislabeled
**Cause:** `dashboard.ts` groups top products by **name**, and the catalog has 174 duplicate names, so distinct products merge into one inflated row (e.g. "Lays French Cheese" 19 = 3 products). Card also sorts by revenue while showing qty, so owner reads it as "most sold".
**Fix:** group by **productId**; sort by **quantity sold** desc; carry the product name for display. Rename card to **"Sales volume"** in `ManagerDashboard.tsx` (keep "X sold · revenue").

## C. Sidebar: Dashboard stays highlighted on POS (platform owner store drilldown)
**Cause:** store-drilldown Dashboard link href = store base `/org/{orgId}/stores/{storeId}`; `isActive` prefix-matches it against every sub-route.
**Fix:** in `AppShell.tsx` `isActive`, exact-match the store root (regex `^/org/[^/]+/stores/[^/]+$`), like `/store` and `/org` already are.

## D. Archive (hide) product feature
Item `1123456788` (and any unwanted product with sales history) can't be deleted — `deleteProduct` blocks products with invoice lines and there's no disable feature.

- **Schema:** add `archivedAt DateTime?` to `Product` (null = active). Additive/nullable migration, safe on live.
- **Domain:** `archiveProduct(id, userId)` sets `archivedAt = now`; `unarchiveProduct` clears it. `deleteProduct` unchanged (hard delete still allowed for never-sold products).
- **Hide from active surfaces:** `getProductsForPOS`, `listProducts` (default), dashboard top products + low stock. **History untouched** (past invoices, reports, COGS still include archived products' sales).
- **Restore:** `listProducts` gains `includeArchived`/`Show archived` filter; archived rows show a badge + Restore action.
- **API:** archive/unarchive via products `[id]` route (PATCH), with activity log + demo-org block, mirroring DELETE.
- **UI:** product row gets a compact ghost Archive icon action; blocked-delete message points to Archive.

**Out of scope:** bulk archive, auto-archive rules.

## Notes
- Work on a branch; user merges to `main` (auto-deploys live). Migration kept additive/nullable.
- Will NOT archive `1123456788` on live data here; owner archives it from Products screen after ship.
