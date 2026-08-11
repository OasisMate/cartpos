-- Raast ID on billing settings.
--
-- Raast is Pakistan's instant bank-to-bank rail: the payer enters a mobile
-- number in their own bank app, it clears instantly and free, and we never have
-- to publish an account number or IBAN. For a POS sold to Pakistani shops this
-- is the primary payment path, not an extra.
--
-- Additive, nullable, idempotent.

ALTER TABLE "BillingSettings" ADD COLUMN IF NOT EXISTS "raastId" TEXT;
