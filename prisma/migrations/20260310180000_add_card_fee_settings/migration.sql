-- Add card payment fee settings to ShopSettings

ALTER TABLE "ShopSettings"
ADD COLUMN "cardFeePercent" DECIMAL(5,2),
ADD COLUMN "allowCardFeeOverride" BOOLEAN NOT NULL DEFAULT false;

