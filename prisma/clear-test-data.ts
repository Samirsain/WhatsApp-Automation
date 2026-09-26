import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Wipes everything a test run leaves behind before switching WhatsApp accounts:
 * every number, batch, notification and activity log, plus the old account's
 * template keys. Keeps users, templates, funnels and settings.
 *
 * Activity logs go first because they reference customers without a cascade;
 * deleting customers then cascades to members, runs, events, conversations,
 * messages and responses. Dry run unless --yes is passed.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const host = new URL(process.env.DATABASE_URL!).hostname;
  const counts = {
    customers: await prisma.customer.count(),
    batches: await prisma.batch.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
    runs: await prisma.automationRun.count(),
    responses: await prisma.customerResponse.count(),
    notifications: await prisma.notification.count(),
    activityLogs: await prisma.activityLog.count(),
    templatesWithOldKey: await prisma.template.count({
      where: { providerTemplateKey: { not: null } },
    }),
  };
  const kept = {
    users: await prisma.user.count(),
    templates: await prisma.template.count(),
    funnels: await prisma.automation.count(),
    settings: await prisma.systemSetting.count(),
  };

  console.log(`database host: ${host}`);
  console.log("will delete:", counts);
  console.log("will keep:", kept);

  if (!process.argv.includes("--yes")) {
    console.log("\nDry run. Pass --yes to delete.");
    return;
  }

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.batch.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.template.updateMany({
      data: { providerTemplateKey: null, approvalStatus: null },
    }),
  ]);
  console.log("\nDone.");
}

main().finally(() => prisma.$disconnect());
