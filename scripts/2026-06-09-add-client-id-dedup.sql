-- Sync de-dup (C1): add an offline client id + unique index to dedupe re-synced
-- customers, purchases, and udhaar payments. Additive and backward-compatible
-- (nullable column; unique index permits existing NULLs). Idempotent.
--
-- Apply to each environment's database before deploying the code that uses clientId.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Payment"  ADD COLUMN IF NOT EXISTS "clientId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_shopId_clientId_key" ON "Customer" ("shopId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_shopId_clientId_key" ON "Purchase" ("shopId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_shopId_clientId_key"  ON "Payment"  ("shopId", "clientId");
