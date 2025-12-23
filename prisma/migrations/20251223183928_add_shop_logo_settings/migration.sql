-- CreateEnumType
DO $$ BEGIN
 CREATE TYPE "ReceiptHeaderDisplay" AS ENUM('NAME_ONLY', 'LOGO_ONLY', 'BOTH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "receiptHeaderDisplay" "ReceiptHeaderDisplay" NOT NULL DEFAULT 'NAME_ONLY';
