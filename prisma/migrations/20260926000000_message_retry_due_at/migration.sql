-- AlterTable
ALTER TABLE "messages" ADD COLUMN "retryDueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "messages_retryDueAt_idx" ON "messages"("retryDueAt");
