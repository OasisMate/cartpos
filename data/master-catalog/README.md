# Master catalog seeds

Generated CSVs used to seed the shared `CatalogProduct` table. The database is
what the app reads; these files exist so a human can review a catalog before it
reaches customers.

The `.csv` files here are **gitignored on purpose**: they carry a live
customer's product names, barcodes and retail prices. Regenerate rather than
commit. If you would rather review catalog changes as git diffs, drop the
ignore rule in `.gitignore` and commit them deliberately.

## Regenerate

```sh
# 1. Read a curated real shop, clean + auto-categorize, write a CSV. Read-only.
npx tsx scripts/build-master-catalog.ts <shopId> data/master-catalog/retail-pk.csv

# 2. Review it. Fill in blank categories, fix wrong ones, delete junk rows.

# 3. Load it. Idempotent; re-running updates in place.
npx tsx scripts/seed-master-catalog.ts data/master-catalog/retail-pk.csv --source "Rose Mart" --dry-run
npx tsx scripts/seed-master-catalog.ts data/master-catalog/retail-pk.csv --source "Rose Mart"
```

## What never travels

`build-master-catalog.ts` only emits barcode, name, unit, category, retail price
and verticals. Cost price, trade price and carton pricing are the source shop's
supplier terms and are not ours to redistribute. Retail is on the packet, and it
travels only as a suggestion the receiving shop overwrites.

Rows without a usable GTIN (8-14 digits) are dropped: the catalog is
barcode-keyed, and shop-local codes mean nothing to anyone else.
