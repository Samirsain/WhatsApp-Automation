import "server-only";
import { prisma } from "@/lib/prisma";

/** Meta's customer-service window: free-form text/media only within 24h of the customer's last message. */
export const WINDOW_MS = 24 * 60 * 60_000;

export type OpenChat = { customerId: string; phoneE164: string; name: string | null; lastText: string | null; lastAt: Date };

/** Customers who wrote in the last 24h, newest first, one row each. */
export async function openChats(now = new Date()): Promise<OpenChat[]> {
  const rows = await prisma.message.findMany({
    where: {
      direction: "INBOUND",
      createdAt: { gte: new Date(now.getTime() - WINDOW_MS) },
      customer: { optedOutAt: null },
    },
    orderBy: { createdAt: "desc" },
    distinct: ["customerId"],
    select: { body: true, createdAt: true, customer: { select: { id: true, phoneE164: true, name: true } } },
  });
  return rows.map((m) => ({
    customerId: m.customer.id,
    phoneE164: m.customer.phoneE164,
    name: m.customer.name,
    lastText: m.body,
    lastAt: m.createdAt,
  }));
}

/** The last 50 messages with one customer, oldest first. */
export async function chatMessages(customerId: string) {
  const rows = await prisma.message.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, direction: true, type: true, body: true, payload: true, deliveryStatus: true, createdAt: true },
  });
  return rows.reverse();
}

export async function isWindowOpen(customerId: string, now = new Date()): Promise<boolean> {
  const count = await prisma.message.count({
    where: { customerId, direction: "INBOUND", createdAt: { gte: new Date(now.getTime() - WINDOW_MS) } },
  });
  return count > 0;
}
