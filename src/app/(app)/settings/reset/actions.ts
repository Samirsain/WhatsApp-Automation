"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

/**
 * Clears test data: batches, notifications, activity logs, and every number
 * that never wrote to us. Anyone with a chat stays, with all their messages —
 * chats are never wiped. Users, templates, funnels and settings stay.
 * Activity logs first — they reference customers without a cascade.
 */
export async function wipeTestData() {
  await assertPermission("settings:manage");

  await prisma.$transaction([
    prisma.activityLog.deleteMany(),
    prisma.customer.deleteMany({ where: { messages: { none: { direction: "INBOUND" } } } }),
    prisma.batch.deleteMany(),
    prisma.notification.deleteMany(),
  ]);

  revalidatePath("/", "layout");
}
