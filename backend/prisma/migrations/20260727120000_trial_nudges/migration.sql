-- Trial nudge emails + the win-back discount they carry.
--
-- trialNudges records which stages already went out ('soon' | 'last_day' | 'expired').
-- It is claimed atomically (UPDATE ... WHERE NOT (trialNudges @> stage)) before the
-- mail is handed to SMTP, so a retried job or a sweep racing the precise job can
-- never send the same customer the same nudge twice.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialNudges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Time-boxed discount offered when a trial lapses. Applies to the next payment only.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "winbackPercent" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "winbackUntil"   TIMESTAMPTZ;

-- The sweep scans for trials nearing expiry; without this it is a full table scan
-- on every pass.
CREATE INDEX IF NOT EXISTS "Tenant_plan_trialEndsAt_idx" ON "Tenant" ("plan", "trialEndsAt");
