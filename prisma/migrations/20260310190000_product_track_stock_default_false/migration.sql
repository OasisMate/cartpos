-- Set Product.trackStock default to false and update existing rows

ALTER TABLE "Product"
ALTER COLUMN "trackStock" SET DEFAULT FALSE;

UPDATE "Product"
SET "trackStock" = FALSE
WHERE "trackStock" IS DISTINCT FROM FALSE;

