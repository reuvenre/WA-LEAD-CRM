-- Wave 1: per-tenant SLA target (minutes) for first-response compliance metrics.
-- Applied manually to Supabase on 2026-07-14.
ALTER TABLE "Tenant" ADD COLUMN "slaTargetMinutes" INTEGER NOT NULL DEFAULT 30;
