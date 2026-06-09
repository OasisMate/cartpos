-- Adds a per-shop timezone setting used to compute the shop's local "today"
-- for dashboards and reports. Additive + idempotent; existing rows default to
-- Asia/Karachi. Safe to run against production.

ALTER TABLE "ShopSettings"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi';
