-- Session revocation.
--
-- Every session cookie carries the tokenVersion it was issued with. Bumping this column
-- makes every outstanding cookie for that user stop working on its next request, which is
-- what a password reset needs in order to contain a compromise.
--
-- Additive and non-destructive: existing rows get 0, and sessions issued before this
-- column existed carry no version claim and are read as 0, so shipping it does not sign
-- anyone out mid-shift. The first password change moves a user off 0 and invalidates them.
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
