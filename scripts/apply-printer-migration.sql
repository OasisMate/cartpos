-- Apply printer settings migration manually
-- Run this if the migration hasn't been applied yet

ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "printerName" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "autoPrint" BOOLEAN NOT NULL DEFAULT false;


