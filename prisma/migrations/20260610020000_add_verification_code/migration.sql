-- Add a 6-digit code as an alternative to the verification link.
ALTER TABLE "EmailVerificationToken" ADD COLUMN "code" TEXT;
