-- Manual migration SQL for allowNegativeStock
-- Run this directly in your Supabase SQL editor or via psql

-- Check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'ShopSettings' 
        AND column_name = 'allowNegativeStock'
    ) THEN
        -- Add the column
        ALTER TABLE "ShopSettings" 
        ADD COLUMN "allowNegativeStock" BOOLEAN NOT NULL DEFAULT true;
        
        RAISE NOTICE 'Column allowNegativeStock added successfully';
    ELSE
        RAISE NOTICE 'Column allowNegativeStock already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'ShopSettings' 
AND column_name = 'allowNegativeStock';


