-- Opt-in login 2FA + password-reset via code.

-- AlterTable: opt-in 2FA flag
ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: code alternative to the reset link
ALTER TABLE "PasswordResetToken" ADD COLUMN "code" TEXT;

-- CreateTable: short-lived login 2FA codes
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginCode_userId_idx" ON "LoginCode"("userId");
CREATE INDEX "LoginCode_expiresAt_idx" ON "LoginCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "LoginCode" ADD CONSTRAINT "LoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable Row Level Security (match all other tables; Prisma connects as superuser and bypasses it)
ALTER TABLE "LoginCode" ENABLE ROW LEVEL SECURITY;
