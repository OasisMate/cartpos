-- Purchase lists: the reorder chit the shop used to write on paper, plus a place
-- to keep the supplier's bill photo against the purchase it belongs to.
-- Additive only: no existing table or column changes.

CREATE TYPE "PurchaseListStatus" AS ENUM ('DRAFT', 'SENT', 'RECEIVED');

CREATE TABLE "PurchaseList" (
    "id"              TEXT NOT NULL,
    "shopId"          TEXT NOT NULL,
    "supplierId"      TEXT,
    "name"            TEXT,
    "status"          "PurchaseListStatus" NOT NULL DEFAULT 'DRAFT',
    "notes"           TEXT,
    "sentAt"          TIMESTAMP(3),
    "purchaseId"      TEXT,
    "createdByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseListLine" (
    "id"             TEXT NOT NULL,
    "purchaseListId" TEXT NOT NULL,
    "productId"      TEXT NOT NULL,
    "quantity"       DECIMAL(10,3) NOT NULL,
    "note"           TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseListLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PurchaseAttachment" (
    "id"         TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "image"      TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseList_purchaseId_key" ON "PurchaseList"("purchaseId");
CREATE INDEX "PurchaseList_shopId_status_idx" ON "PurchaseList"("shopId", "status");
CREATE INDEX "PurchaseList_shopId_createdAt_idx" ON "PurchaseList"("shopId", "createdAt");
CREATE UNIQUE INDEX "PurchaseListLine_purchaseListId_productId_key" ON "PurchaseListLine"("purchaseListId", "productId");
CREATE INDEX "PurchaseListLine_purchaseListId_idx" ON "PurchaseListLine"("purchaseListId");
CREATE INDEX "PurchaseAttachment_purchaseId_idx" ON "PurchaseAttachment"("purchaseId");

ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_shopId_fkey"
    FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseList" ADD CONSTRAINT "PurchaseList_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseListLine" ADD CONSTRAINT "PurchaseListLine_purchaseListId_fkey"
    FOREIGN KEY ("purchaseListId") REFERENCES "PurchaseList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseListLine" ADD CONSTRAINT "PurchaseListLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseAttachment" ADD CONSTRAINT "PurchaseAttachment_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project posture: RLS on, no policies. Prisma connects as "postgres" (bypassrls)
-- and there is no supabase-js client, so no application route is affected.
ALTER TABLE "PurchaseList"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseListLine"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseAttachment" ENABLE ROW LEVEL SECURITY;
