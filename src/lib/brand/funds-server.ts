import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import {
  computeBalance,
  fundsStatus,
  istDayStart,
  istMonthStart,
  parseBalance,
  spendSince,
  type Balance,
} from "./funds";

export const BALANCE_KEY = "funds.balance";

export async function getBalanceSetting(): Promise<Balance | null> {
  return parseBalance(await getSetting(BALANCE_KEY));
}

/** Meta's pricing_analytics from `since` until now, or null if Meta cannot be reached. */
async function fetchAnalytics(since: Date): Promise<unknown | null> {
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!waba || !token) return null;
  const fields =
    `pricing_analytics.start(${Math.floor(since.getTime() / 1000)}).end(${Math.floor(Date.now() / 1000)})` +
    `.granularity(DAILY).dimensions(["PRICING_CATEGORY"]).metric_types(["COST","VOLUME"])`;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v25.0/${waba}?fields=${encodeURIComponent(fields)}`,
      { headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 } },
    );
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export type FundsSnapshot = {
  status: "ok" | "out" | "unknown";
  balance: Balance | null;
  /** null when no balance is set or Meta's spend could not be read. */
  left: number | null;
  messagesLeft: number | null;
  low: boolean;
  spentThisMonth: number | null;
};

export async function getFundsSnapshot(): Promise<FundsSnapshot> {
  const [balance, latest] = await Promise.all([
    getBalanceSetting(),
    prisma.message.findFirst({
      where: { direction: "OUTBOUND", type: "TEMPLATE" },
      orderBy: { createdAt: "desc" },
      select: { failureCode: true },
    }),
  ]);
  const status = fundsStatus(latest);

  const monthStart = istMonthStart(new Date());
  const balanceDay = balance ? istDayStart(new Date(balance.at)) : null;
  const since = balanceDay && balanceDay < monthStart ? balanceDay : monthStart;
  const analytics = await fetchAnalytics(since);
  if (!analytics) {
    return { status, balance, left: null, messagesLeft: null, low: false, spentThisMonth: null };
  }

  const spentThisMonth = spendSince(analytics as never, monthStart.getTime() / 1000).spent;
  if (!balance || !balanceDay) {
    return { status, balance, left: null, messagesLeft: null, low: false, spentThisMonth };
  }
  const b = computeBalance({ baseline: balance.amount, ...spendSince(analytics as never, balanceDay.getTime() / 1000) });
  return { status, balance, left: b.left, messagesLeft: b.messagesLeft, low: b.low, spentThisMonth };
}
