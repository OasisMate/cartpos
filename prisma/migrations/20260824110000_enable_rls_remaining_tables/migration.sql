-- Enable Row Level Security on the 13 tables that were added after
-- 20260322010000_enable_rls_all_tables and missed the project-wide posture.
-- Supabase's database linter flags them as rls_disabled_in_public (ERROR), and
-- BillingSettings additionally as sensitive_columns_exposed (iban).
--
-- Same posture as every other table: enable RLS, add no policies. That denies
-- the anon/authenticated PostgREST roles all access. Prisma connects as
-- "postgres" (rolbypassrls = true) and the app has no supabase-js client, so
-- no application route is affected. ALTER ... ENABLE is idempotent.

ALTER TABLE "StockLot"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PackagingLevel"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quotation"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuotationLine"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleReturn"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleReturnLine"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shift"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Plan"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentClaim"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingSettings"     ENABLE ROW LEVEL SECURITY;
