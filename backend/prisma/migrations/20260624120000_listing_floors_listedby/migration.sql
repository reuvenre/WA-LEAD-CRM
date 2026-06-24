-- Add total building floors ("קומה X מתוך Y") and private/agency classification.
ALTER TABLE "Listing" ADD COLUMN "totalFloors" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ADD COLUMN "listedBy" TEXT NOT NULL DEFAULT '';
