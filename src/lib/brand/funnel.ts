import "server-only";
import { prisma } from "@/lib/prisma";
import { nextFunnelAction, type BrandPayload } from "./rules";
import { sendBrandMessage } from "./send";

/**
 * Funnel follow-ups. A step whose followUpAt is due, with no reply since, gets
 * the next step; after step 3 the number is marked NO_RESPONSE (red on
 * "No reply"). Rows are claimed by clearing followUpAt, like sendDueRetries.
 */
export async function sendDueFollowUps(now = new Date()): Promise<{ sent: number; red: number; skipped: number }> {
  const due = await prisma.message.findMany({
    where: { followUpAt: { lte: now } },
    select: {
      id: true,
      createdAt: true,
      customerId: true,
      deliveryStatus: true,
      payload: true,
      customer: { select: { phoneE164: true, qualifiedAt: true, optedOutAt: true } },
    },
    take: 50, // ponytail: 50 per tick (every 15 min); raise if a day's sends outgrow it
  });
  let sent = 0;
  let red = 0;
  let skipped = 0;
  for (const m of due) {
    const claim = await prisma.message.updateMany({
      where: { id: m.id, followUpAt: { not: null } },
      data: { followUpAt: null },
    });
    if (claim.count !== 1) continue;

    // Any message since — their reply, or a newer send/retry to them — ends this chain.
    const since = await prisma.message.count({
      where: {
        customerId: m.customerId,
        createdAt: { gt: m.createdAt },
        OR: [{ direction: "INBOUND" }, { payload: { path: ["kind"], equals: "brand" } }],
      },
    });
    const next = nextFunnelAction((m.payload as BrandPayload).step ?? 1, {
      anythingSince: since > 0,
      failed: m.deliveryStatus === "FAILED",
      brandLead: m.customer.qualifiedAt !== null,
      optedOut: m.customer.optedOutAt !== null,
    });
    if (next === "skip") skipped++;
    else if (next === "red") {
      await prisma.customer.update({ where: { id: m.customerId }, data: { status: "NO_RESPONSE" } });
      red++;
    } else {
      await sendBrandMessage({ e164: m.customer.phoneE164, name: null, step: next });
      sent++;
    }
  }
  return { sent, red, skipped };
}
