-- Persist packaging factor + label on each invoice line so edits/voids can reverse
-- the correct number of base units and so carton/pack lines can be reloaded for editing.
ALTER TABLE "InvoiceLine"
  ADD COLUMN "unitsPerItem" DECIMAL(10, 3) NOT NULL DEFAULT 1,
  ADD COLUMN "packName" TEXT;

-- Backfill unitsPerItem from the stock ledger where derivable:
-- units-per-item = |sum(changeQty)| / quantity for the line's SALE entries.
-- Leaves the default (1) for lines with no ledger rows or zero quantity.
UPDATE "InvoiceLine" il
SET "unitsPerItem" = sub.factor
FROM (
  SELECT sl."refId" AS line_id,
         ABS(SUM(sl."changeQty")) / NULLIF(il2."quantity", 0) AS factor
  FROM "StockLedger" sl
  JOIN "InvoiceLine" il2 ON il2."id" = sl."refId"
  WHERE sl."refType" = 'invoice_line'
  GROUP BY sl."refId", il2."quantity"
) sub
WHERE il."id" = sub.line_id
  AND sub.factor IS NOT NULL
  AND sub.factor > 0;
