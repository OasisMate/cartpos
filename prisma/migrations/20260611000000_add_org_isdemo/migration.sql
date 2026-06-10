-- Add demo/test-fixture flag to Organization (additive, non-destructive).
-- When true, destructive API actions are blocked org-wide (see lib/demo.ts).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
