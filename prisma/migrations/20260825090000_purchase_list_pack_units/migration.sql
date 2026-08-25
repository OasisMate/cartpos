-- The shop sells in pieces but orders in packs (a pet of 6, a carton of 24).
-- Same pair InvoiceLine already uses for a sale made by the carton.
ALTER TABLE "PurchaseListLine" ADD COLUMN "packName" TEXT;
ALTER TABLE "PurchaseListLine" ADD COLUMN "unitsPerItem" DECIMAL(10,3) NOT NULL DEFAULT 1;
