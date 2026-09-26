import "server-only";
import { prisma } from "@/lib/prisma";
import type { BrandPayload } from "./rules";
import { sendBrandMessage } from "./send";

/**
 * Re-send brand messages whose 131049 retry is due. Each row is claimed by
 * clearing retryDueAt with a conditional update, so two overlapping ticks
 * cannot both send it.
 */
export async function sendDueRetries(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const due = await prisma.message.findMany({
    where: { retryDueAt: { lte: now } },
    select: {
      id: true,
      createdAt: true,
      customerId: true,
      payload: true,
      customer: { select: { phoneE164: true } },
    },
    take: 50, // ponytail: 50 per tick; raise if a day's failures outgrow it
  });

  let sent = 0;
  let skipped = 0;
  for (const m of due) {
    const claim = await prisma.message.updateMany({
      where: { id: m.id, retryDueAt: { not: null } },
      data: { retryDueAt: null },
    });
    if (claim.count !== 1) continue;

    const newer = await prisma.message.count({
      where: {
        customerId: m.customerId,
        direction: "OUTBOUND",
        createdAt: { gt: m.createdAt },
        payload: { path: ["kind"], equals: "brand" },
      },
    });
    // A manual resend in the meantime already covers the number.
    if (newer > 0) {
      skipped++;
      continue;
    }

    const p = m.payload as BrandPayload;
    await sendBrandMessage({
      e164: m.customer.phoneE164,
      name: null,
      step: p.step ?? 1,
      retryOf: m.id,
    });
    sent++;
  }
  return { sent, skipped };
}
