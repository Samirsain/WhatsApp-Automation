import "server-only";
import { prisma } from "@/lib/prisma";
import { byStageThenNewest, stepOf } from "./funnel-list";

/**
 * Everyone in the funnel: each number's latest brand message, minus people
 * who tapped Brand (they are in Chats) and people marked Not interested.
 * Sorted 3/3 first, then 2/3, then 1/3.
 */
export async function funnelRows() {
  const recent = await prisma.message.findMany({
    where: { direction: "OUTBOUND", payload: { path: ["kind"], equals: "brand" } },
    orderBy: { createdAt: "desc" },
    take: 2000, // ponytail: newest 2000 sends; paginate if the list outgrows it
    select: {
      id: true,
      customerId: true,
      deliveryStatus: true,
      createdAt: true,
      payload: true,
      customer: {
        select: { leadNumber: true, name: true, phoneE164: true, status: true, qualifiedAt: true },
      },
    },
  });
  const seen = new Set<string>();
  const rows = [];
  for (const m of recent) {
    if (seen.has(m.customerId)) continue;
    seen.add(m.customerId);
    if (m.customer.qualifiedAt !== null || m.customer.status === "NOT_INTERESTED") continue;
    rows.push({ ...m, step: stepOf(m.payload) });
  }
  return rows.sort(byStageThenNewest);
}

export type FunnelRow = Awaited<ReturnType<typeof funnelRows>>[number];
