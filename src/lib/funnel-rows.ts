import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { byStageThenNewest, stepOf } from "./funnel-list";

const BRAND_SENT = { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } } satisfies Prisma.MessageWhereInput;

/** Out of the funnel: tapped Brand or marked Interested (they are in Chats), archived, blocked or Not interested. */
const IN_FUNNEL = {
  qualifiedAt: null,
  interestedAt: null,
  chatArchivedAt: null,
  blockedAt: null,
  status: { not: "NOT_INTERESTED" },
} satisfies Prisma.CustomerWhereInput;

/**
 * Everyone in the funnel: each number's latest brand message, minus the
 * people IN_FUNNEL leaves out. Sorted 3/3 first, then 2/3, then 1/3.
 */
export async function funnelRows() {
  const recent = await prisma.message.findMany({
    where: { ...BRAND_SENT, customer: IN_FUNNEL },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: newest 2000 sends; paginate if the list outgrows it
    select: {
      id: true,
      customerId: true,
      deliveryStatus: true,
      createdAt: true,
      payload: true,
      customer: {
        select: { leadNumber: true, name: true, phoneE164: true, status: true },
      },
    },
  });
  const seen = new Set<string>();
  const rows = [];
  for (const m of recent) {
    if (seen.has(m.customerId)) continue;
    seen.add(m.customerId);
    rows.push({ ...m, step: stepOf(m.payload) });
  }
  return rows.sort(byStageThenNewest);
}

/** How many rows funnelRows() returns, for the sidebar, without loading them. */
export function funnelCount() {
  return prisma.customer.count({ where: { ...IN_FUNNEL, messages: { some: BRAND_SENT } } });
}

export type FunnelRow = Awaited<ReturnType<typeof funnelRows>>[number];
