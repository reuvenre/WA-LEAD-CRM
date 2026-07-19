-- Account offboarding lifecycle. On cancel: canceledAt = now, purgeAt = now + 30d.
-- During the grace window the account is read-only and can be reactivated; at purgeAt a
-- scheduled job hard-deletes the tenant and all its data. NULL = active account.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMPTZ;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "purgeAt" TIMESTAMPTZ;
