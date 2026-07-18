-- Free-trial expiry: when the window closes, a TRIAL tenant drops to read-only
-- until it upgrades. NULL = no trial deadline (paid plans, or legacy tenants).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMPTZ;

-- Give any existing TRIAL tenant a fresh 14-day window rather than locking it now.
UPDATE "Tenant" SET "trialEndsAt" = now() + interval '14 days'
  WHERE plan = 'TRIAL' AND "trialEndsAt" IS NULL;
