-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "category" TEXT,
    "brand" TEXT,
    "suggestedPrice" DECIMAL(10,2),
    "verticals" TEXT[],
    "status" "CatalogStatus" NOT NULL DEFAULT 'PENDING',
    "shopCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSighting" (
    "id" TEXT NOT NULL,
    "catalogProductId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSighting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogProduct_barcode_key" ON "CatalogProduct"("barcode");

-- CreateIndex
CREATE INDEX "CatalogProduct_status_category_idx" ON "CatalogProduct"("status", "category");

-- CreateIndex
CREATE INDEX "CatalogProduct_status_name_idx" ON "CatalogProduct"("status", "name");

-- CreateIndex
CREATE INDEX "CatalogSighting_shopId_idx" ON "CatalogSighting"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSighting_catalogProductId_shopId_key" ON "CatalogSighting"("catalogProductId", "shopId");

-- AddForeignKey
ALTER TABLE "CatalogSighting" ADD CONSTRAINT "CatalogSighting_catalogProductId_fkey" FOREIGN KEY ("catalogProductId") REFERENCES "CatalogProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Match the project-wide RLS posture (see 20260322010000_enable_rls_all_tables).
-- The app connects as owner and enforces access in code; RLS is defence in depth
-- against a leaked anon key. No policies = no access for anon/authenticated.
ALTER TABLE "CatalogProduct"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CatalogSighting" ENABLE ROW LEVEL SECURITY;
