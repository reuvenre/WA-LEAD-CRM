-- ─────────────────────────────────────────────────────────────────────────────
-- Multi-line foundation (Phase 1). Additive + backfill only — nothing is dropped,
-- and the existing single-line flow keeps working (leads get attached to a "main
-- line" created from each tenant's current Green API credentials).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Provider enum
DO $$ BEGIN
  CREATE TYPE "LineProvider" AS ENUM ('GREEN_API', 'META');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Line table (one WhatsApp number = one line)
CREATE TABLE IF NOT EXISTS "Line" (
  "id"                 TEXT NOT NULL,
  "tenantId"           TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "provider"           "LineProvider" NOT NULL DEFAULT 'GREEN_API',
  "phoneNumber"        TEXT,
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "assignedUserId"     TEXT,
  "greenApiInstanceId" TEXT,
  "greenApiToken"      TEXT,
  "metaPhoneNumberId"  TEXT,
  "metaAccessToken"    TEXT,
  "metaWabaId"         TEXT,
  "webhookSecret"      TEXT,
  "dailyCount"         INTEGER NOT NULL DEFAULT 0,
  "dailyCountDate"     TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Line_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Line_greenApiInstanceId_key" ON "Line"("greenApiInstanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Line_metaPhoneNumberId_key" ON "Line"("metaPhoneNumberId");
CREATE INDEX IF NOT EXISTS "Line_tenantId_idx" ON "Line"("tenantId");
CREATE INDEX IF NOT EXISTS "Line_assignedUserId_idx" ON "Line"("assignedUserId");

DO $$ BEGIN
  ALTER TABLE "Line" ADD CONSTRAINT "Line_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Line" ADD CONSTRAINT "Line_assignedUserId_fkey"
    FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Lead.lineId (nullable) + FK + index
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lineId" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_lineId_idx" ON "Lead"("lineId");

DO $$ BEGIN
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "Line"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Backfill: create one "main line" per configured tenant from its current Green
--    API credentials (idempotent — skips if a line already owns that instance).
INSERT INTO "Line" ("id","tenantId","name","provider","greenApiInstanceId","greenApiToken","webhookSecret","active","dailyCount","createdAt","updatedAt")
SELECT gen_random_uuid()::text, t."id", 'קו ראשי', 'GREEN_API',
       t."greenApiInstanceId", t."greenApiToken", t."webhookSecret", true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE t."greenApiInstanceId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Line" l WHERE l."greenApiInstanceId" = t."greenApiInstanceId");

-- 5. Attach every existing lead to its tenant's main line (each tenant has exactly
--    one line at this point, so the match is unambiguous).
UPDATE "Lead" ld
SET "lineId" = l."id"
FROM "Line" l
WHERE l."tenantId" = ld."tenantId"
  AND ld."lineId" IS NULL;
