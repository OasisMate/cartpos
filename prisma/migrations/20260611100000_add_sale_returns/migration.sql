-- Returns / Refunds / Exchange: credit-note tables. Additive only.

-- CreateEnum
CREATE TYPE "SaleReturnKind" AS ENUM ('REFUND', 'EXCHANGE');
CREATE TYPE "ReturnSettlement" AS ENUM ('CASH', 'ACCOUNT_CREDIT');

-- CreateTable
CREATE TABLE "SaleReturn" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "originalInvoiceId" TEXT NOT NULL,
    "customerId" TEXT,
    "kind" "SaleReturnKind" NOT NULL DEFAULT 'REFUND',
    "returnTotal" DECIMAL(10,2) NOT NULL,
    "replacementTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netRefund" DECIMAL(10,2) NOT NULL,
    "settlementMethod" "ReturnSettlement" NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "isReplacement" BOOLEAN NOT NULL DEFAULT false,
    "restocked" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SaleReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleReturn_shopId_createdAt_idx" ON "SaleReturn"("shopId", "createdAt");
CREATE INDEX "SaleReturn_originalInvoiceId_idx" ON "SaleReturn"("originalInvoiceId");
CREATE INDEX "SaleReturnLine_returnId_idx" ON "SaleReturnLine"("returnId");
CREATE INDEX "SaleReturnLine_productId_idx" ON "SaleReturnLine"("productId");

-- AddForeignKey
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturnLine" ADD CONSTRAINT "SaleReturnLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
