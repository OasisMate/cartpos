-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "clientSaleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_shopId_clientSaleId_key" ON "Invoice"("shopId", "clientSaleId");
