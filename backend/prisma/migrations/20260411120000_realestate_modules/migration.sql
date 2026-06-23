-- Real-estate domain models (phase-2 integration). All tenant-scoped.

-- ─── Deal ─────────────────────────────────────────────────────────────────────
CREATE TABLE "Deal" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "projectName"    TEXT NOT NULL,
    "blockParcel"    TEXT,
    "city"           TEXT,
    "status"         TEXT NOT NULL DEFAULT 'Scouting',
    "gdv"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "riskAlert"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Deal_tenantId_idx" ON "Deal"("tenantId");
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Property ─────────────────────────────────────────────────────────────────
CREATE TABLE "Property" (
    "id"                 TEXT NOT NULL,
    "tenantId"           TEXT NOT NULL,
    "title"              TEXT NOT NULL,
    "addressCity"        TEXT,
    "priceRequested"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"             TEXT NOT NULL DEFAULT 'Active',
    "exclusivityEndDate" TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── REProject (new construction) ─────────────────────────────────────────────
CREATE TABLE "REProject" (
    "id"               TEXT NOT NULL,
    "tenantId"         TEXT NOT NULL,
    "projectName"      TEXT NOT NULL,
    "developer"        TEXT,
    "city"             TEXT,
    "neighborhood"     TEXT,
    "address"          TEXT,
    "status"           TEXT NOT NULL DEFAULT 'under_construction',
    "expectedDelivery" TEXT,
    "deliveryEarliest" TEXT,
    "deliveryLatest"   TEXT,
    "totalUnits"       INTEGER NOT NULL DEFAULT 0,
    "availableUnits"   INTEGER,
    "unitTypes"        INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "priceMin"         DOUBLE PRECISION,
    "priceMax"         DOUBLE PRECISION,
    "amenities"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "urbanRenewal"     BOOLEAN NOT NULL DEFAULT false,
    "urbanRenewalType" TEXT,
    "salesOffice"      TEXT,
    "source"           TEXT NOT NULL DEFAULT 'CRM (ידני)',
    "sourceTier"       INTEGER NOT NULL DEFAULT 5,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "REProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "REProject_tenantId_idx" ON "REProject"("tenantId");
ALTER TABLE "REProject" ADD CONSTRAINT "REProject_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Listing (resale) ─────────────────────────────────────────────────────────
CREATE TABLE "Listing" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "type"         TEXT NOT NULL DEFAULT 'דירה',
    "city"         TEXT,
    "neighborhood" TEXT,
    "street"       TEXT,
    "rooms"        INTEGER NOT NULL DEFAULT 0,
    "floor"        INTEGER NOT NULL DEFAULT 0,
    "sizeSqm"      INTEGER NOT NULL DEFAULT 0,
    "price"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parking"      BOOLEAN NOT NULL DEFAULT false,
    "elevator"     BOOLEAN NOT NULL DEFAULT false,
    "balcony"      BOOLEAN NOT NULL DEFAULT false,
    "renovated"    BOOLEAN NOT NULL DEFAULT false,
    "entry"        TEXT NOT NULL DEFAULT 'מיידי',
    "status"       TEXT NOT NULL DEFAULT 'פעיל',
    "agent"        TEXT,
    "source"       TEXT NOT NULL DEFAULT 'CRM (ידני)',
    "sourceUrl"    TEXT NOT NULL DEFAULT '',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Listing_tenantId_idx" ON "Listing"("tenantId");
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── REClient (buyer profile for matching) ────────────────────────────────────
CREATE TABLE "REClient" (
    "id"         TEXT NOT NULL,
    "tenantId"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "phone"      TEXT,
    "city"       TEXT,
    "rooms"      INTEGER NOT NULL DEFAULT 0,
    "budgetMax"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryBy" TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "REClient_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "REClient_tenantId_idx" ON "REClient"("tenantId");
ALTER TABLE "REClient" ADD CONSTRAINT "REClient_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
