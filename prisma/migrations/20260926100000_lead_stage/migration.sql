-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'INTERESTED', 'ONBOARDING', 'NOT_INTERESTED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "leadStage" "LeadStage" NOT NULL DEFAULT 'NEW';

-- CreateIndex
CREATE INDEX "customers_status_leadStage_idx" ON "customers"("status", "leadStage");

