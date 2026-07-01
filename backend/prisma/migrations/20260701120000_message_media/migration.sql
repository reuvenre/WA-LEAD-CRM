-- Add 'document' to the MessageType enum (idempotent)
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'document';

-- Store the hosted media URL + original filename for image/document messages
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "fileName" TEXT;
