-- Offline idempotency keys: dedupe records created offline so re-sync can't duplicate them.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_shopId_clientId_key" ON "Expense"("shopId", "clientId");

ALTER TABLE "StockLedger" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "StockLedger_shopId_clientId_key" ON "StockLedger"("shopId", "clientId");

-- Sync error reports sent from shop devices when sync fails.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SyncReportStatus') THEN
    CREATE TYPE "SyncReportStatus" AS ENUM ('NEW', 'REVIEWED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SyncErrorReport" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "shopId" TEXT,
  "userId" TEXT NOT NULL,
  "status" "SyncReportStatus" NOT NULL DEFAULT 'NEW',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SyncErrorReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SyncErrorReport_status_createdAt_idx" ON "SyncErrorReport"("status", "createdAt");

ALTER TABLE "SyncErrorReport" ENABLE ROW LEVEL SECURITY;
