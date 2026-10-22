import "server-only";
import { leadId } from "@/lib/lead-id";
import { prisma } from "@/lib/prisma";

export type AlreadyMessaged = { e164: string; leadId: string; lastSentAt: string };

/**
 * Which of these numbers this app has already messaged. Broadcast skips them,
 * so nobody gets the Funnel 1 message twice; the funnel's own follow-ups and
 * retries do not go through here.
 */
export async function findAlreadyMessaged(e164s: string[]): Promise<Map<string, AlreadyMessaged>> {
  if (e164s.length === 0) return new Map();
  const customers = await prisma.customer.findMany({
    where: { phoneE164: { in: e164s }, messages: { some: { direction: "OUTBOUND" } } },
    select: {
      phoneE164: true,
      leadNumber: true,
      messages: {
        where: { direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  return new Map(
    customers.map((c) => [
      c.phoneE164,
      { e164: c.phoneE164, leadId: leadId(c.leadNumber), lastSentAt: c.messages[0].createdAt.toISOString() },
    ]),
  );
}
