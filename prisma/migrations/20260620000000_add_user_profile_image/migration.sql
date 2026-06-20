-- User profile photo, stored as a base64 data URL (PNG/JPEG).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
