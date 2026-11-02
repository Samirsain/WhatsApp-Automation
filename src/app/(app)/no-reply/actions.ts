"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

/**
 * No more automatic funnel steps (or 131049 retries) for this number. The tick
 * claims a step by clearing followUpAt, so clearing it first means it never goes.
 * They are not blocked: a Brand tap still gets the guide, and a manual send restarts the funnel.
 */
export async function stopFunnel(customerId: string): Promise<void> {
  const user = await assertPermission("batch:manage");
  const id = z.uuid().parse(customerId);
  const stopped = await prisma.message.updateMany({
    where: { customerId: id, OR: [{ followUpAt: { not: null } }, { retryDueAt: { not: null } }] },
    data: { followUpAt: null, retryDueAt: null },
  });
  if (stopped.count > 0) {
    await logActivity({
      actorUserId: user.id,
      eventType: "funnel.stopped",
      objectType: "customer",
      objectId: id,
      customerId: id,
    });
  }
  revalidatePath("/no-reply");
}
