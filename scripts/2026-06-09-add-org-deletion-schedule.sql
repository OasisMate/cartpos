-- Safe org deletion: schedule a purge that can only run after a buffer.
-- Additive + idempotent. Safe to run against production.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletionScheduledBy" TEXT;
