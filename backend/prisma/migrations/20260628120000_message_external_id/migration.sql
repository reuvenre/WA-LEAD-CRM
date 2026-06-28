-- Store the Green API message id so delivered/read status webhooks can update it.
ALTER TABLE "Message" ADD COLUMN "externalId" TEXT;
CREATE INDEX "Message_externalId_idx" ON "Message"("externalId");
