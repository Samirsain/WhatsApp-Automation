import "server-only";
import { prisma } from "@/lib/prisma";

/** Meta's customer-service window: free-form text/media only within 24h of the customer's last message. */
export const WINDOW_MS = 24 * 60 * 60_000;

export type OpenChat = {
  customerId: string;
  phoneE164: string;
  name: string | null;
  lastText: string | null;
  /** Their last message; null if they never wrote (marked Interested only). Drives the 24h window. */
  lastAt: Date | null;
  /** Where the chat sits in the list: their last message or the Interested tap, whichever is newer. */
  sortAt: Date;
  /** Marked Interested from the Funnel page. */
  interested: boolean;
  /** Archived and not written since; a new message from them brings the chat back. */
  archived: boolean;
  blocked: boolean;
};

const CUSTOMER = { id: true, phoneE164: true, name: true, chatArchivedAt: true, blockedAt: true, interestedAt: true } as const;

/**
 * Everyone who ever wrote in, plus everyone marked Interested, newest first,
 * one row each. Closed and opted-out chats stay, so nothing is lost; sending
 * is blocked for them in message/actions.ts.
 */
export async function allChats(): Promise<OpenChat[]> {
  const [inbound, interested] = await Promise.all([
    prisma.message.findMany({
      where: { direction: "INBOUND" },
      orderBy: { createdAt: "desc" },
      distinct: ["customerId"],
      select: { body: true, type: true, createdAt: true, customer: { select: CUSTOMER } },
    }),
    prisma.customer.findMany({ where: { interestedAt: { not: null } }, select: CUSTOMER }),
  ]);
  const last = new Map(inbound.map((m) => [m.customer.id, m]));
  const customers = new Map([...interested, ...inbound.map((m) => m.customer)].map((c) => [c.id, c]));

  return [...customers.values()]
    .map((c) => {
      const m = last.get(c.id);
      const lastAt = m?.createdAt ?? null;
      const sortAt = new Date(Math.max(lastAt?.getTime() ?? 0, c.interestedAt?.getTime() ?? 0));
      return {
        customerId: c.id,
        phoneE164: c.phoneE164,
        name: c.name,
        lastText: m ? m.body || (m.type === "MEDIA" ? "📎 Media" : null) : null,
        lastAt,
        sortAt,
        interested: c.interestedAt !== null,
        archived: c.chatArchivedAt !== null && c.chatArchivedAt >= sortAt,
        blocked: c.blockedAt !== null,
      };
    })
    .sort((a, b) => b.sortAt.getTime() - a.sortAt.getTime());
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
