-- Close the PostgREST hole: every public table gets RLS with no policies.
--
-- Supabase auto-exposes the `public` schema over PostgREST, reachable by anyone
-- holding the project's anon key. The app never uses that path — it talks to
-- Postgres through Prisma as the table OWNER, and owners bypass RLS — so an
-- enabled-but-policy-less table is invisible to the API and unchanged for us.
-- (Proven in place: Tenant, User, Lead, Message et al. have shipped this way.)
--
-- Ten tables were missed and were readable/writable with the anon key alone,
-- including Deal, Property and REClient (customer PII) and CampaignRecipient
-- (phone numbers). ENABLE is idempotent, so re-running this is a no-op.
ALTER TABLE "Job"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Line"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaign"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Deal"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Property"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "REProject"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Listing"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "REClient"          ENABLE ROW LEVEL SECURITY;
