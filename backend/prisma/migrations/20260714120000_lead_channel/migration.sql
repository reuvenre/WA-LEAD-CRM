-- Multi-channel lead identity: webchat/IG/Messenger contacts have no phone.
-- phone becomes nullable; non-phone channels are keyed by (tenantId, channel, externalId).
-- The existing (tenantId, phone) unique is untouched — Postgres skips NULL rows in
-- composite unique indexes, so multiple NULL-phone leads coexist safely.
-- Applied manually to Supabase on 2026-07-14.

CREATE TYPE "LeadChannel" AS ENUM ('WHATSAPP','WEBCHAT','INSTAGRAM','MESSENGER');

ALTER TABLE "Lead" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Lead" ADD COLUMN "channel" "LeadChannel" NOT NULL DEFAULT 'WHATSAPP';
ALTER TABLE "Lead" ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "Lead_tenantId_channel_externalId_key" ON "Lead"("tenantId","channel","externalId");
