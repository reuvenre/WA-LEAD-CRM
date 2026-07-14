-- Wave 1: round-robin auto-assignment + auto-replies (greeting / off-hours / away).
-- Applied manually to Supabase on 2026-07-14.

-- Round-robin: rotate new inbound leads across active agents.
ALTER TABLE "Tenant" ADD COLUMN "assignmentMode" TEXT NOT NULL DEFAULT 'manual'; -- 'manual' | 'round_robin'
ALTER TABLE "Tenant" ADD COLUMN "assignmentPointer" INTEGER NOT NULL DEFAULT 0;

-- Auto-replies config (JSON): { greeting, offHours, away } each {enabled, text, ...}.
ALTER TABLE "Tenant" ADD COLUMN "autoReplies" JSONB;

-- Throttle auto-replies per lead (at most one per 6h) — avoids reply loops/spam.
ALTER TABLE "Lead" ADD COLUMN "lastAutoReplyAt" TIMESTAMP(3);
