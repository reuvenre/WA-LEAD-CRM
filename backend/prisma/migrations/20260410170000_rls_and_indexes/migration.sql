-- ─── Performance: covering indexes for foreign keys + hot query paths ─────────
-- Prisma does not auto-create indexes on FK columns. Names match Prisma's
-- @@index convention so future `migrate dev` runs detect no drift.

CREATE INDEX "Lead_tenantId_lastMessageAt_idx" ON "Lead"("tenantId", "lastMessageAt");
CREATE INDEX "Lead_tenantId_meetingDate_idx" ON "Lead"("tenantId", "meetingDate");
CREATE INDEX "Lead_projectId_idx" ON "Lead"("projectId");
CREATE INDEX "Message_leadId_timestamp_idx" ON "Message"("leadId", "timestamp");
CREATE INDEX "Activity_leadId_createdAt_idx" ON "Activity"("leadId", "createdAt");
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");
CREATE INDEX "AutomationWebhook_tenantId_idx" ON "AutomationWebhook"("tenantId");
CREATE INDEX "Template_tenantId_idx" ON "Template"("tenantId");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- ─── Security: enable Row Level Security on every public table ─────────────────
-- With RLS enabled and NO policies, the Supabase anon/PostgREST REST API is fully
-- denied. The backend connects via Prisma as the table owner (`postgres` role),
-- which bypasses RLS, so application access is unaffected — no code changes needed.

ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AutomationWebhook" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
