-- Cash drawer / shift management. All additive + idempotent so existing data is untouched.

-- 1) Per-shop enforcement toggle (default off preserves current behaviour).
ALTER TABLE "ShopSettings" ADD COLUMN IF NOT EXISTS "requireOpenDrawer" BOOLEAN NOT NULL DEFAULT false;

-- 2) Enums.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShiftStatus') THEN
    CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashDir') THEN
    CREATE TYPE "CashDir" AS ENUM ('IN', 'OUT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CashMoveType') THEN
    CREATE TYPE "CashMoveType" AS ENUM ('PAY_IN', 'PAY_OUT', 'BANK_DROP', 'OWNER_DRAW', 'FLOAT_ADD', 'OTHER');
  END IF;
END $$;

-- 3) Shift table.
CREATE TABLE IF NOT EXISTS "Shift" (
  "id"           TEXT NOT NULL,
  "shopId"       TEXT NOT NULL,
  "openedById"   TEXT NOT NULL,
  "label"        TEXT,
  "status"       "ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openingFloat" DECIMAL(10,2) NOT NULL,
  "openedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedById"   TEXT,
  "closedAt"     TIMESTAMP(3),
  "countedCash"  DECIMAL(10,2),
  "expectedCash" DECIMAL(10,2),
  "variance"     DECIMAL(10,2),
  "closingNote"  TEXT,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Shift_shopId_status_idx" ON "Shift"("shopId", "status");
CREATE INDEX IF NOT EXISTS "Shift_openedById_status_idx" ON "Shift"("openedById", "status");
CREATE INDEX IF NOT EXISTS "Shift_shopId_openedAt_idx" ON "Shift"("shopId", "openedAt");

-- 4) CashMovement table.
CREATE TABLE IF NOT EXISTS "CashMovement" (
  "id"        TEXT NOT NULL,
  "shopId"    TEXT NOT NULL,
  "shiftId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "direction" "CashDir" NOT NULL,
  "type"      "CashMoveType" NOT NULL,
  "amount"    DECIMAL(10,2) NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");
CREATE INDEX IF NOT EXISTS "CashMovement_shopId_createdAt_idx" ON "CashMovement"("shopId", "createdAt");

-- 5) shiftId on existing cash sources.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_shiftId_idx" ON "Payment"("shiftId");
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
CREATE INDEX IF NOT EXISTS "Expense_shiftId_idx" ON "Expense"("shiftId");
ALTER TABLE "SupplierLedger" ADD COLUMN IF NOT EXISTS "shiftId" TEXT;
CREATE INDEX IF NOT EXISTS "SupplierLedger_shiftId_idx" ON "SupplierLedger"("shiftId");

-- 6) Foreign keys (guarded so re-runs are safe).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_shopId_fkey') THEN
    ALTER TABLE "Shift" ADD CONSTRAINT "Shift_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_openedById_fkey') THEN
    ALTER TABLE "Shift" ADD CONSTRAINT "Shift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Shift_closedById_fkey') THEN
    ALTER TABLE "Shift" ADD CONSTRAINT "Shift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_shopId_fkey') THEN
    ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_shiftId_fkey') THEN
    ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashMovement_userId_fkey') THEN
    ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_shiftId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_shiftId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupplierLedger_shiftId_fkey') THEN
    ALTER TABLE "SupplierLedger" ADD CONSTRAINT "SupplierLedger_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
