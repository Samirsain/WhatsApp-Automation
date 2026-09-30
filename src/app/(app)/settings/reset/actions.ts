"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

/**
 * Same wipe as `prisma/clear-test-data.ts`, minus the template-key reset:
 * every number, batch, notification and activity log. Users, templates,
 * funnels and settings stay. Activity logs first — they reference customers
 * without a cascade; customers then cascade to runs, chats and messages.
 */
export async function wipeTestData() {
  await assertPermission("settings:manage");

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.batch.deleteMany(),
    prisma.notification.deleteMany(),
  ]);

  revalidatePath("/", "layout");
}
