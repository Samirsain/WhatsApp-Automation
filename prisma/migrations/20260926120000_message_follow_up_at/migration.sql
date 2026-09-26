-- AlterTable
ALTER TABLE "messages" ADD COLUMN "followUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "messages_followUpAt_idx" ON "messages"("followUpAt");
