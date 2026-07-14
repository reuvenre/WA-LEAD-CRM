-- Wave 1: per-tenant custom lead attributes (definitions on Tenant, values on Lead).
-- JSONB rather than a table — v1 needs display/edit + template vars, not SQL filtering.
-- Applied manually to Supabase on 2026-07-14.
ALTER TABLE "Tenant" ADD COLUMN "attributeDefs" JSONB; -- [{key,label,type,options?}]
ALTER TABLE "Lead" ADD COLUMN "attributes" JSONB;      -- { [key]: string | number }
