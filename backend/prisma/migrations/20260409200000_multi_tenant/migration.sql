-- Multi-tenant migration
-- Clears existing single-tenant data and builds new schema

-- 1. Drop old data (clean slate)
TRUNCATE TABLE "Activity" CASCADE;
TRUNCATE TABLE "Message"  CASCADE;
TRUNCATE TABLE "Template" CASCADE;
TRUNCATE TABLE "AutomationWebhook" CASCADE;
TRUNCATE TABLE "Lead"     CASCADE;

-- 2. Create enums
CREATE TYPE "UserRole"   AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT');
CREATE TYPE "TenantPlan" AS ENUM ('TRIAL', 'BASIC', 'PRO');

-- 3. Create Tenant table
CREATE TABLE "Tenant" (
    "id"                   TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "email"                TEXT NOT NULL,
    "plan"                 "TenantPlan" NOT NULL DEFAULT 'TRIAL',
    "active"               BOOLEAN NOT NULL DEFAULT true,
    "greenApiInstanceId"   TEXT,
    "greenApiToken"        TEXT,
    "greenApiWebhookUrl"   TEXT,
    "totpSecret"           TEXT,
    "totpEnabled"          BOOLEAN NOT NULL DEFAULT false,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_email_key" ON "Tenant"("email");

-- 4. Create User table
CREATE TABLE "User" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "username"     TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         "UserRole" NOT NULL DEFAULT 'AGENT',
    "active"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Add tenantId to Lead
ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT;

-- Drop old unique constraint on phone (now scoped per tenant)
DROP INDEX IF EXISTS "Lead_phone_key";

-- 6. Add tenantId to Message
ALTER TABLE "Message" ADD COLUMN "tenantId" TEXT;

-- 7. Add tenantId to Template
ALTER TABLE "Template" ADD COLUMN "tenantId" TEXT;

-- 8. Add tenantId + userId to Activity
ALTER TABLE "Activity" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Activity" ADD COLUMN "userId"   TEXT;

-- 9. Add tenantId to AutomationWebhook
ALTER TABLE "AutomationWebhook" ADD COLUMN "tenantId" TEXT;

-- 10. Insert default tenant (win-solutions)
INSERT INTO "Tenant" ("id","name","email","plan","active","createdAt","updatedAt")
VALUES (
    'tenant_default',
    'Win Solutions',
    'admin@win-solutions.com',
    'PRO',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 11. Insert default admin user (win-solutions / Ari020224!@#$%)
INSERT INTO "User" ("id","tenantId","username","passwordHash","role","active","createdAt","updatedAt")
VALUES (
    'user_default_admin',
    'tenant_default',
    'win-solutions',
    '$2b$10$gbmej66qryaiq0dTYY/ApOzEyrjaP.4vc7N4Sbvx66jZ11MSDd9qy',
    'ADMIN',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- 12. Now make tenantId NOT NULL on all tables
ALTER TABLE "Lead"              ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Message"           ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Template"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "Activity"          ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "AutomationWebhook" ALTER COLUMN "tenantId" SET NOT NULL;

-- 13. Add unique constraint for Lead (tenantId, phone)
CREATE UNIQUE INDEX "Lead_tenantId_phone_key" ON "Lead"("tenantId", "phone");

-- 14. Add foreign keys
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message" ADD CONSTRAINT "Message_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Template" ADD CONSTRAINT "Template_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AutomationWebhook" ADD CONSTRAINT "AutomationWebhook_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
