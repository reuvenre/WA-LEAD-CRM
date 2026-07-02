-- Per-tenant webhook secret embedded in the webhook URL to authenticate inbound Green API calls
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;
