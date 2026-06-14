-- Add nullable archivedAt to Product (soft-hide; history preserved). Additive, safe on live.
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);
