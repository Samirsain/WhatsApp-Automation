-- Lead statuses are now New, Not interested, Member added.
-- Onboarding leads become Member added; Interested go back to New.
ALTER TYPE "LeadStage" RENAME TO "LeadStage_old";
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'NOT_INTERESTED', 'MEMBER_ADDED');
ALTER TABLE "customers"
  ALTER COLUMN "leadStage" DROP DEFAULT,
  ALTER COLUMN "leadStage" TYPE "LeadStage" USING (
    CASE "leadStage"::text
      WHEN 'ONBOARDING' THEN 'MEMBER_ADDED'
      WHEN 'INTERESTED' THEN 'NEW'
      ELSE "leadStage"::text
    END
  )::"LeadStage",
  ALTER COLUMN "leadStage" SET DEFAULT 'NEW';
DROP TYPE "LeadStage_old";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "chatArchivedAt" TIMESTAMP(3);
