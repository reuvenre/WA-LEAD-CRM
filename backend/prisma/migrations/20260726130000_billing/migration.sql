-- Paid subscriptions. Until now the only lifecycle a tenant had was TRIAL → read-only;
-- these columns give a tenant a paid state that renews, can fall behind, and can be
-- cancelled at period end without losing the remaining paid days.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingProvider"   TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingToken"      TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "billingCycle"      TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subStatus"         TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currentPeriodEnd"  TIMESTAMPTZ;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- Settled-charge ledger. (provider, providerRef) is UNIQUE on purpose: payment
-- providers retry webhooks until they get a 200, so the uniqueness constraint is
-- what stops a replayed callback from granting a second billing period.
CREATE TABLE IF NOT EXISTS "Payment" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "provider"    TEXT NOT NULL,
  "providerRef" TEXT NOT NULL,
  "plan"        "TenantPlan" NOT NULL,
  "cycle"       TEXT NOT NULL,
  "amount"      INTEGER NOT NULL,
  "currency"    TEXT NOT NULL DEFAULT 'ILS',
  "status"      TEXT NOT NULL,
  "periodStart" TIMESTAMPTZ NOT NULL,
  "periodEnd"   TIMESTAMPTZ NOT NULL,
  "invoiceUrl"  TEXT,
  "raw"         JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerRef_key" ON "Payment" ("provider", "providerRef");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_createdAt_idx" ON "Payment" ("tenantId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same PostgREST lockdown every other table gets (see 20260726120000_rls_lockdown):
-- payment rows are invisible to the anon key; Prisma owns the table and bypasses RLS.
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
