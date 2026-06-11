-- Optional wholesale/trade per-unit price (for contractors / bulk buyers).
ALTER TABLE "Product" ADD COLUMN "tradePrice" DECIMAL(10,2);
