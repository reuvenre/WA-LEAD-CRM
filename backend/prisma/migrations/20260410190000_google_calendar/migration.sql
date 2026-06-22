-- Google Calendar one-way sync (per user)
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "googleEmail" TEXT;

-- Mirror of the created Google Calendar event on each lead
ALTER TABLE "Lead" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "googleCalendarUserId" TEXT;
