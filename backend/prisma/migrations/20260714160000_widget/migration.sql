-- Wave 2: website chat widget config on the tenant.
-- Applied manually to Supabase on 2026-07-14.
ALTER TABLE "Tenant" ADD COLUMN "widgetKey" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "widgetEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "widgetConfig" JSONB; -- { title, greeting, color }
CREATE UNIQUE INDEX "Tenant_widgetKey_key" ON "Tenant"("widgetKey");
