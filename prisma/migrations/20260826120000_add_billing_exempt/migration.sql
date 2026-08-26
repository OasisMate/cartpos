-- Free access granted by a platform admin. Additive and idempotent: existing
-- rows default to false, so nobody's billing changes when this is applied.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingExempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingExemptNote" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingExemptAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "billingExemptBy" TEXT;
