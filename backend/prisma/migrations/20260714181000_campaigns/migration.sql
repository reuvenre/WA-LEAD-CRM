-- Wave 3: broadcast campaigns + drip sequences.
-- Campaign.body = one-shot broadcast; Campaign.steps = drip [{afterHours, body}].
-- Applied manually to Supabase on 2026-07-14.
CREATE TABLE "Campaign" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "body" TEXT NOT NULL DEFAULT '',
  "filter" JSONB,
  "steps" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft', -- draft | scheduled | running | paused | done
  "scheduledAt" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Campaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Campaign_tenantId_idx" ON "Campaign"("tenantId");

CREATE TABLE "CampaignRecipient" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending', -- pending | sent | delivered | read | failed | skipped
  "messageId" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignRecipient_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CampaignRecipient_campaignId_leadId_key" ON "CampaignRecipient"("campaignId","leadId");
CREATE INDEX "CampaignRecipient_campaignId_idx" ON "CampaignRecipient"("campaignId");
CREATE INDEX "CampaignRecipient_messageId_idx" ON "CampaignRecipient"("messageId");
