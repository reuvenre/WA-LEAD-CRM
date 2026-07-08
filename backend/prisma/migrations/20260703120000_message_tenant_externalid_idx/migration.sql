-- Composite index for the webhook status-update / idempotency hot path
-- (Message lookups by tenantId + externalId).
CREATE INDEX IF NOT EXISTS "Message_tenantId_externalId_idx" ON "Message"("tenantId", "externalId");
