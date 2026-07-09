-- Google Sign-In (explicit account linking): store the linked Google account id (sub)
-- and its email. Additive + nullable — no impact on existing password/2FA login.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleLoginEmail" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
