-- Enable Row Level Security on every table.
-- No policies are added, so the anon/authenticated PostgREST roles
-- are denied all access. Prisma connects as the postgres superuser
-- which bypasses RLS, so the application is unaffected.

ALTER TABLE "Organization"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Shop"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserShop"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationUser"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShopSettings"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockLedger"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseLine"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerLedger"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLine"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
