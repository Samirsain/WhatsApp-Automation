"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity";
import { parseStage } from "@/lib/brand/stages";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

export async function setLeadStage(customerId: string, stage: string): Promise<void> {
  const user = await assertPermission("batch:manage");
  const next = parseStage(stage);
  if (!next) return;
  const updated = await prisma.customer.updateMany({
    where: { id: customerId, status: "QUALIFIED" },
    data: { leadStage: next },
  });
  if (updated.count === 1) {
    await logActivity({
      actorUserId: user.id,
      eventType: "lead.stage_changed",
      objectType: "customer",
      objectId: customerId,
      customerId,
      after: { leadStage: next },
    });
  }
  revalidatePath("/leads");
}
