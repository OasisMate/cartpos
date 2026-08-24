# Starter catalogs

Pre-built product lists that seed a brand-new shop. Most Pakistani shops that
sign up have no records at all - they ran from memory - so there is nothing to
import. These files mean their first day is spent selling, not typing.

Each file is a CSV in the product-import template format, keyed by shop
vertical. `src/lib/domain/starter-catalog.ts` maps `OrganizationType` to a slug;
several verticals share one file (a kiryana, a general store and a convenience
store stock much the same FMCG).

| File | Serves |
| --- | --- |
| `kiryana-store.csv` | KIRYANA_STORE, GENERAL_STORE, CONVENIENCE_STORE, SUPERMARKET, RETAIL_STORE |
| `hardware-store.csv` | HARDWARE_STORE, SANITARY_STORE |

## Regenerating one

Curate a real shop through the normal product UI, then export it:

```sh
npx tsx scripts/export-catalog.ts <shopId> data/starter-catalogs/kiryana-store.csv
```

Review the git diff before committing. That review is the whole reason these are
files and not database rows.

## What must never be in these files

The export script drops these columns, and hand edits must not reintroduce them:

- `costPrice`, `tradePrice`, `cartonPrice`, `cartonBarcode` - the source shop's
  supplier terms. Another org's margins are not ours to redistribute.
- `sku` - regenerated per shop on import.
- Stock levels - catalogs carry no stock. Stock arrives via purchases.

Retail `price` **is** included on purpose: packaged FMCG in Pakistan is largely
printed MRP, so it is a sane default the new shop corrects where it differs.
That saves the shopkeeper pricing every row by hand.

## Loading one into a shop

Self-serve: the products page offers it in the empty state, matched to the org's
vertical.

Hands-on:

```sh
npx tsx scripts/seed-catalog.ts <shopId> --dry-run   # check first
npx tsx scripts/seed-catalog.ts <shopId>
```

Seeding only works while a shop has zero products. After that, CSV import is the
right tool.
