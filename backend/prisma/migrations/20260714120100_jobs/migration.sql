-- Job table: deferred work (scheduled messages, campaign steps, CSAT surveys).
-- Polled in-process by lib/jobs.ts (single-instance deployment).
-- Applied manually to Supabase on 2026-07-14.

CREATE TABLE "Job" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "runAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Job_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Job_status_runAt_idx" ON "Job"("status","runAt");
CREATE INDEX "Job_tenantId_idx" ON "Job"("tenantId");
