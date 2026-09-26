import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { computeFunds, istDayStart, parseTopups, sumSpend, type Topup } from "./funds";

export const TOPUPS_KEY = "funds.topups";

export async function getTopups(): Promise<Topup[]> {
  return parseTopups(await getSetting(TOPUPS_KEY));
}

/** Meta's reported spend from the day of the first top-up until now. */
async function fetchSpend(since: Date): Promise<{ spent: number; marketing: number } | null> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!waba || !token) return null;
  const start = Math.floor(since.getTime() / 1000);
  const end = Math.floor(Date.now() / 1000);
  const fields =
    `pricing_analytics.start(${start}).end(${end}).granularity(DAILY)` +
    `.dimensions(["PRICING_CATEGORY"]).metric_types(["COST","VOLUME"])`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${waba}?fields=${encodeURIComponent(fields)}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return sumSpend(await res.json());
  } catch {
    return null;
  }
}

export type FundsSnapshot = {
  hasTopups: boolean;
  /** Amount of the most recent top-up, for the undo button. */
  lastTopup: number | null;
  added: number;
  spent: number | null;
  left: number | null;
  perMessage: number;
  messagesLeft: number | null;
  /** A brand message failed with 131042 (payment) after the latest top-up. */
  outOfFunds: boolean;
};

export async function getFundsSnapshot(): Promise<FundsSnapshot> {
  const topups = await getTopups();
  const added = topups.reduce((s, t) => s + t.amount, 0);
  const lastTopup = topups.at(-1)?.amount ?? null;
  const latest = topups.reduce<Date | null>((d, t) => {
    const at = new Date(t.at);
    return !d || at > d ? at : d;
  }, null);

  const paymentFailure = await prisma.message.findFirst({
    where: {
      failureCode: "131042",
      ...(latest && { createdAt: { gt: latest } }),
    },
    select: { id: true },
  });

  if (topups.length === 0) {
    return { hasTopups: false, lastTopup, added: 0, spent: null, left: null, perMessage: 0.86, messagesLeft: null, outOfFunds: Boolean(paymentFailure) };
  }

  const first = istDayStart(new Date(Math.min(...topups.map((t) => Date.parse(t.at)))));
  const spend = await fetchSpend(first);
  if (!spend) {
    return { hasTopups: true, lastTopup, added, spent: null, left: null, perMessage: 0.86, messagesLeft: null, outOfFunds: Boolean(paymentFailure) };
  }
  const f = computeFunds({ added, ...spend });
  return { hasTopups: true, lastTopup, ...f, outOfFunds: Boolean(paymentFailure) };
}
