-- Record what packaging a returned item was sold as.
--
-- SaleReturnLine held only a quantity, with no record of whether that quantity meant loose
-- units or cartons. Two things were wrong as a result: returning one carton of twelve put a
-- single unit back into stock, and the cost of goods reversed by the return was a twelfth of
-- what the sale had booked.
--
-- Additive with a default of 1, which is exactly right for every row that exists: no shop has
-- recorded a pack return, so all existing returns are loose-unit returns.
ALTER TABLE "SaleReturnLine" ADD COLUMN "unitsPerItem" DECIMAL(10,3) NOT NULL DEFAULT 1;
ALTER TABLE "SaleReturnLine" ADD COLUMN "packName" TEXT;
