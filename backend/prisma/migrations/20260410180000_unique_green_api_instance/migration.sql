-- A Green API instance belongs to exactly one tenant. Enforce uniqueness so two
-- tenants can never claim the same instanceId (which would mis-route incoming
-- webhooks). NULLs remain distinct in Postgres, so unconfigured tenants are fine.
CREATE UNIQUE INDEX "Tenant_greenApiInstanceId_key" ON "Tenant"("greenApiInstanceId");
