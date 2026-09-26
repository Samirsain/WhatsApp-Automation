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
    select: { id: true, payload: true, customer: { select: { phoneE164: true } } },
  });
  const p = m?.payload as BrandPayload | null;
  if (!m || p?.kind !== "brand") return;
  await sendBrandMessage({
    e164: m.customer.phoneE164,
    name: null,
    pick: { template: p.template, image: p.image },
    retryOf: m.id,
  });
  revalidatePath("/failed");
}
