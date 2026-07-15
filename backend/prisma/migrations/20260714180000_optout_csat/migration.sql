-- Wave 3: opt-out compliance + CSAT survey score on the lead.
-- Applied manually to Supabase on 2026-07-14.
ALTER TABLE "Lead" ADD COLUMN "optedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "csatScore" INTEGER;
ALTER TABLE "Lead" ADD COLUMN "csatAskedAt" TIMESTAMP(3);
