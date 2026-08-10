-- Billing / subscriptions: plans, subscriptions, manual payments, payment
-- claims, billing settings, plus shop/seat pause columns.
--
-- Purely additive. Idempotent (guards on every statement) so it is safe to run
-- against production, and safe to re-run.
--
-- Deliberately NOT included: `prisma migrate diff` also proposes dropping
-- CashMovement_shiftId_fkey and re-adding it as RESTRICT. The live DB has had
-- CASCADE since 20260621010000_add_cash_drawer_shifts; the schema has now been
-- corrected to declare CASCADE, so live behaviour is unchanged and no DDL is
-- needed here.

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Distinct from the existing `PaymentMethod` (CASH/CARD/OTHER), which is how a
-- customer paid the shop. This is how a shop paid us.
DO $$ BEGIN
  CREATE TYPE "BillingPaymentMethod" AS ENUM ('BANK_TRANSFER', 'JAZZCASH', 'EASYPAISA', 'CASH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PauseReason" AS ENUM ('OWNER_CLOSED', 'PLAN_DOWNGRADE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------
-- Existing tables: additive columns only
-- ---------------------------------------------------------------
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;

-- Defaults are true, so every existing shop and seat stays active. No live
-- shop is frozen by this migration.
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pausedBy" TEXT;
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "pausedReason" "PauseReason";

ALTER TABLE "UserShop" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserShop" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);

-- ---------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "maxShops" INTEGER,
    "maxUsers" INTEGER,
    "maxCashiers" INTEGER,
    "allowOrgLevel" BOOLEAN NOT NULL DEFAULT false,
    "extraShopPrice" DECIMAL(10,2),
    "features" TEXT[],
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "cycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "agreedMonthlyPrice" DECIMAL(10,2) NOT NULL,
    "priceNote" TEXT,
    "priceSetBy" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "extraShops" INTEGER NOT NULL DEFAULT 0,
    "shopSwapUsedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "BillingPaymentMethod" NOT NULL,
    "reference" TEXT,
    "cycle" "BillingCycle" NOT NULL,
    "monthsAdded" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentClaim" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "BillingPaymentMethod" NOT NULL,
    "reference" TEXT,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "cycle" "BillingCycle" NOT NULL,
    "note" TEXT,
    "receiptImage" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "paymentId" TEXT,
    "submittedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BillingSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bankName" TEXT,
    "accountTitle" TEXT,
    "accountNumber" TEXT,
    "iban" TEXT,
    "jazzcashNumber" TEXT,
    "easypaisaNumber" TEXT,
    "whatsappNumber" TEXT,
    "supportEmail" TEXT,
    "instructions" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingSettings_pkey" PRIMARY KEY ("id")
);

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_code_key" ON "Plan"("code");
CREATE INDEX IF NOT EXISTS "Plan_isActive_sortOrder_idx" ON "Plan"("isActive", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX IF NOT EXISTS "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_organizationId_receivedAt_idx" ON "SubscriptionPayment"("organizationId", "receivedAt");
CREATE INDEX IF NOT EXISTS "PaymentClaim_status_createdAt_idx" ON "PaymentClaim"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentClaim_organizationId_idx" ON "PaymentClaim"("organizationId");

-- ---------------------------------------------------------------
-- Foreign keys (guarded, same pattern as 20260621010000)
-- ---------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_organizationId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_planId_fkey') THEN
    ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionPayment_organizationId_fkey') THEN
    ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentClaim_organizationId_fkey') THEN
    ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
