-- Move 2FA (TOTP) from per-tenant to per-user.

-- Add per-user 2FA columns
ALTER TABLE "User" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Best-effort migrate existing tenant-level 2FA to that tenant's ADMIN user(s),
-- so anyone who already enabled 2FA keeps it after the change.
UPDATE "User" u
SET "totpSecret" = t."totpSecret",
    "totpEnabled" = t."totpEnabled"
FROM "Tenant" t
WHERE u."tenantId" = t."id"
  AND u."role" = 'ADMIN'
  AND t."totpEnabled" = true
  AND t."totpSecret" IS NOT NULL;

-- Drop per-tenant 2FA columns
ALTER TABLE "Tenant" DROP COLUMN "totpSecret";
ALTER TABLE "Tenant" DROP COLUMN "totpEnabled";
