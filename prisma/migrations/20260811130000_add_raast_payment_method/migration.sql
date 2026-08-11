-- Add RAAST to the subscription payment methods.
--
-- /billing recommends Raast as the easiest way to pay, but the "I have paid"
-- form had no matching option, so a shop that used it had to report "Bank
-- transfer" or "Other". Listing it separately keeps the shop's answer honest and
-- lets us see how many take the instant route.
--
-- Additive and idempotent. ADD VALUE IF NOT EXISTS is safe to re-run.

ALTER TYPE "BillingPaymentMethod" ADD VALUE IF NOT EXISTS 'RAAST';
