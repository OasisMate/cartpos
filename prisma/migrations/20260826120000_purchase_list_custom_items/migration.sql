-- Off-catalogue purchase list items: a shopkeeper can type a name that is not
-- in their products. Such a line has no productId, so it reaches the supplier
-- on the shared/printed list but is skipped when the list is received.
ALTER TABLE "PurchaseListLine" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "PurchaseListLine" ADD COLUMN "customName" TEXT;

-- The (purchaseListId, productId) unique index still merges repeat scans of a
-- real product. Postgres treats NULLs as distinct, so off-catalogue lines never
-- collide with each other.
