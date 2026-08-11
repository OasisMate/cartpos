-- Track who last edited a plan.
--
-- ActivityLog cannot carry this: its orgId is a required FK to Organization and
-- a plan belongs to no organization. BillingSettings already solves it the same
-- way with its own updatedBy column.
--
-- Additive, nullable, idempotent.

ALTER TABLE "Plan" ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;
