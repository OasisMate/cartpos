-- SQL script to fix ShopRole enum in database
-- Run this directly in Supabase SQL Editor if connection issues persist
-- This renames SHOP_OWNER to STORE_MANAGER in the ShopRole enum

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
        RAISE NOTICE 'Successfully renamed SHOP_OWNER to STORE_MANAGER';
    ELSE
        RAISE NOTICE 'SHOP_OWNER does not exist in ShopRole enum (may already be renamed)';
    END IF;
END $$;

-- Verify the enum values
SELECT 
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'ShopRole'
ORDER BY e.enumsortorder;

