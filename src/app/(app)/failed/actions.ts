"use server";

import { revalidatePath } from "next/cache";
import type { BrandPayload } from "@/lib/brand/rules";
import { sendBrandMessage } from "@/lib/brand/send";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/lib/session";

export async function resendBrand(formData: FormData): Promise<void> {
  await assertPermission("batch:manage");
  const id = String(formData.get("messageId") ?? "");
  const m = await prisma.message.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      customerId: true,
      retryDueAt: true,
      payload: true,
      customer: { select: { phoneE164: true } },
    },
  });
  const p = m?.payload as BrandPayload | null;
  if (!m || p?.kind !== "brand" || m.retryDueAt) return;

  // A double-click, or a second person on a stale page, must not send a second
  // paid template: once anything newer went to this number, this row is done.
  const newer = await prisma.message.count({
    where: {
      customerId: m.customerId,
      direction: "OUTBOUND",
      createdAt: { gt: m.createdAt },
      payload: { path: ["kind"], equals: "brand" },
    },
  });
  if (newer > 0) return;
  await sendBrandMessage({
    e164: m.customer.phoneE164,
    name: null,
    step: p.step ?? 1,
    retryOf: m.id,
  });
  revalidatePath("/failed");
}
