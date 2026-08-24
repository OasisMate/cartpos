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

# 2. Rows the rules could not categorize are split into a second file:
#      retail-pk-uncategorized.csv
#    Fill its `category` column, then SAVE IT AS retail-pk-reviewed.csv.

# 3. Load. Later files win per barcode, so corrections layer over the generated file.
npx tsx scripts/seed-master-catalog.ts data/master-catalog/retail-pk.csv   data/master-catalog/retail-pk-reviewed.csv --source "Rose Mart" --dry-run
npx tsx scripts/seed-master-catalog.ts data/master-catalog/retail-pk.csv   data/master-catalog/retail-pk-reviewed.csv --source "Rose Mart"
```

## Why `-reviewed`, not `-uncategorized`

`build-master-catalog.ts` **overwrites `-uncategorized.csv` on every run**. Save
your corrections under `-reviewed.csv`, which nothing generates, or the next
rebuild throws the manual pass away.

Belt and braces: the seed never overwrites a category or price already in the
database with a blank one, so a rebuilt CSV cannot silently undo manual work
that has already been loaded.

## What never travels

`build-master-catalog.ts` only emits barcode, name, unit, category, retail price
and verticals. Cost price, trade price and carton pricing are the source shop's
supplier terms and are not ours to redistribute. Retail is on the packet, and it
travels only as a suggestion the receiving shop overwrites.

Rows without a usable GTIN (8-14 digits) are dropped: the catalog is
barcode-keyed, and shop-local codes mean nothing to anyone else.
