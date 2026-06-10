-- Email verification: confirm a signup's email ownership before admin review.

-- AlterTable: add emailVerified flag (defaults false for new rows)
ALTER TABLE "User" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather all existing accounts as verified so no current user is locked out.
UPDATE "User" SET "emailVerified" = true;

-- CreateTable: one-time verification tokens (mirrors PasswordResetToken)
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");
CREATE INDEX "EmailVerificationToken_token_idx" ON "EmailVerificationToken"("token");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (match all other tables; Prisma connects as superuser and bypasses it)
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
