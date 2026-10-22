-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "leadNumber" SERIAL NOT NULL;

-- Existing customers are numbered in the order they arrived, oldest first.
UPDATE "customers" AS c
SET "leadNumber" = o.n
FROM (SELECT "id", row_number() OVER (ORDER BY "createdAt", "id") AS n FROM "customers") AS o
WHERE c."id" = o."id";

-- CreateIndex
CREATE UNIQUE INDEX "customers_leadNumber_key" ON "customers"("leadNumber");
