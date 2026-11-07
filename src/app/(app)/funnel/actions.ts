"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

/** Pending funnel steps and 131049 retries for one number: the tick claims a step by clearing these. */
const pendingSteps = (customerId: string) => ({
  where: { customerId, OR: [{ followUpAt: { not: null } }, { retryDueAt: { not: null } }] },
  data: { followUpAt: null, retryDueAt: null },
});

/**
 * Moves a number from Funnel to Not Interested and stops its funnel for good.
 * Not a block: if they write or tap Brand later, Chats still shows it.
 */
export async function markNotInterested(customerId: string): Promise<void> {
  const user = await assertPermission("batch:manage");
  const id = z.uuid().parse(customerId);
  const now = new Date();
  await prisma.$transaction([
    prisma.customer.update({ where: { id }, data: { status: "NOT_INTERESTED", notInterestedAt: now } }),
    prisma.message.updateMany(pendingSteps(id)),
    prisma.automationRun.updateMany({
      where: { customerId: id, state: { in: ["RUNNING", "WAITING", "PAUSED"] } },
      data: { state: "STOPPED", stoppedAt: now, stopReason: "not_interested", nextActionAt: null },
    }),
  ]);
  await logActivity({
    actorUserId: user.id,
    eventType: "customer.not_interested",
    objectType: "customer",
    objectId: id,
    customerId: id,
  });
  revalidatePath("/funnel");
  revalidatePath("/not-interested");
}

/**
 * Puts the number in Chats (even if they never wrote, and back out of Archived)
 * and opens their chat. The funnel keeps running; Stop funnel or Block ends it.
 */
export async function markInterested(customerId: string): Promise<void> {
  const user = await assertPermission("batch:manage");
  const id = z.uuid().parse(customerId);
  await prisma.customer.update({ where: { id }, data: { interestedAt: new Date(), chatArchivedAt: null } });
  await logActivity({
    actorUserId: user.id,
    eventType: "customer.interested",
    objectType: "customer",
    objectId: id,
    customerId: id,
  });
  revalidatePath("/message");
  redirect(`/message?c=${id}`);
}
