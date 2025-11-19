-- Rename SHOP_OWNER enum value to STORE_MANAGER
-- This migration safely renames the enum value if it exists

DO $$
BEGIN
  -- Check if SHOP_OWNER exists and rename it
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
