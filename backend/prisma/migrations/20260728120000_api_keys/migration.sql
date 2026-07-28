-- Per-tenant API credentials. The PRO plan has advertised "גישת API + אינטגרציות"
-- in the pricing grid while no key mechanism existed; this is what makes that real.
--
-- Only the SHA-256 of a key is stored. keyHash is UNIQUE so authentication is one
-- indexed lookup instead of a scan-and-compare, and a database leak yields nothing
-- that can be replayed against the API.
CREATE TABLE IF NOT EXISTS "ApiKey" (
  "id"         TEXT NOT NULL,
  "tenantId"   TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "keyHash"    TEXT NOT NULL,
  "prefix"     TEXT NOT NULL,
  "lastUsedAt" TIMESTAMPTZ,
  "revokedAt"  TIMESTAMPTZ,
  "createdBy"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey" ("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_tenantId_idx" ON "ApiKey" ("tenantId");

DO $$ BEGIN
  ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Same PostgREST lockdown as every other table (see 20260726120000_rls_lockdown).
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
