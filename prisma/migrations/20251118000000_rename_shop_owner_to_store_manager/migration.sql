-- Rename SHOP_OWNER enum value to STORE_MANAGER
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ShopRole'
      AND e.enumlabel = 'SHOP_OWNER'
  ) THEN
    ALTER TYPE "ShopRole" RENAME VALUE 'SHOP_OWNER' TO 'STORE_MANAGER';
  END IF;
END $$;

-- Rename SHOP_OWNER enum value to STORE_MANAGER
-- This migration creates a new enum with the desired values, migrates the data, then swaps it in.

CREATE TYPE "ShopRole_new" AS ENUM ('STORE_MANAGER', 'CASHIER');

ALTER TABLE "UserShop"
  ALTER COLUMN "shopRole" TYPE "ShopRole_new"
  USING ("shopRole"::text::"ShopRole_new");

ALTER TYPE "ShopRole" RENAME TO "ShopRole_old";
ALTER TYPE "ShopRole_new" RENAME TO "ShopRole";
DROP TYPE "ShopRole_old";

