-- AlterEnum
BEGIN;
CREATE TYPE "ShopRole_new" AS ENUM ('SHOP_OWNER', 'CASHIER');
ALTER TABLE "UserShop" ALTER COLUMN "shopRole" TYPE "ShopRole_new" USING ("shopRole"::text::"ShopRole_new");
ALTER TYPE "ShopRole" RENAME TO "ShopRole_old";
ALTER TYPE "ShopRole_new" RENAME TO "ShopRole";
DROP TYPE "public"."ShopRole_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('PLATFORM_ADMIN', 'NORMAL');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'NORMAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "Shop" DROP CONSTRAINT "Shop_orgId_fkey";

-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "orgId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

