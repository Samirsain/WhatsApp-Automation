"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

/**
 * Undo "Not interested": the number is listed in Funnel again. The stopped
 * steps do not come back; a new broadcast or manual send restarts them.
 */
export async function backToFunnel(customerId: string): Promise<void> {
  const user = await assertPermission("batch:manage");
  const id = z.uuid().parse(customerId);
  const moved = await prisma.customer.updateMany({
    where: { id, status: "NOT_INTERESTED" },
    data: { status: "IN_FUNNEL", notInterestedAt: null },
  });
  if (moved.count === 1) {
    await logActivity({
      actorUserId: user.id,
      eventType: "customer.back_to_funnel",
      objectType: "customer",
      objectId: id,
      customerId: id,
    });
  }
  revalidatePath("/funnel");
  revalidatePath("/not-interested");
}
