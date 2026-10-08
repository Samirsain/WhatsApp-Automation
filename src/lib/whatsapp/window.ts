import "server-only";
import { prisma } from "@/lib/prisma";

/** Meta's customer-service window: free-form text/media only within 24h of the customer's last message. */
export const WINDOW_MS = 24 * 60 * 60_000;

export type OpenChat = { customerId: string; phoneE164: string; name: string | null; lastText: string | null; lastAt: Date };

/**
 * Everyone who ever wrote in, newest first, one row each. Closed and opted-out
 * chats stay, so nothing is lost; sending is blocked for them in message/actions.ts.
 */
export async function allChats(): Promise<OpenChat[]> {
  const rows = await prisma.message.findMany({
    where: { direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    distinct: ["customerId"],
    select: { body: true, type: true, createdAt: true, customer: { select: { id: true, phoneE164: true, name: true } } },
  });
  return rows.map((m) => ({
    customerId: m.customer.id,
    phoneE164: m.customer.phoneE164,
    name: m.customer.name,
    lastText: m.body || (m.type === "MEDIA" ? "📎 Media" : null),
    lastAt: m.createdAt,
  }));
}

/**
 * The whole chat with one customer, oldest first.
 * ponytail: loads every message; add "load older" paging if one chat grows to thousands.
 */
export async function chatMessages(customerId: string) {
  const rows = await prisma.message.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
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
