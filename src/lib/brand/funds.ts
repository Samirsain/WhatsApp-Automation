/**
 * Pure funds logic. Meta does not expose the prepaid WhatsApp balance outside
 * Business Solution Providers, so the panel shows a status and the real spend
 * Meta reports, and links to Meta Billing for the exact balance and top-ups.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight India time on the day of `at`. Meta reports daily spend in the
 * account's timezone, so a range starting at UTC midnight would skip the day.
 * ponytail: IST hardcoded; read the WABA timezone if the account ever moves.
 */
export function istDayStart(at: Date): Date {
  const local = at.getTime() + IST_OFFSET_MS;
  return new Date(local - (local % DAY_MS) - IST_OFFSET_MS);
}

/** Midnight India time on the 1st of the month containing `at`. */
export function istMonthStart(at: Date): Date {
  const local = new Date(at.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - IST_OFFSET_MS);
}

type Analytics = {
  pricing_analytics?: {
    data?: {
      data_points?: { start?: number; pricing_category?: string; volume?: number; cost?: number }[];
    }[];
  };
};

/** Cost and marketing volume of the buckets that start at or after `sinceSec`. */
export function spendSince(body: Analytics, sinceSec: number): { spent: number; marketing: number } {
  let spent = 0;
  let marketing = 0;
  for (const d of body.pricing_analytics?.data ?? []) {
    for (const p of d.data_points ?? []) {
      if ((p.start ?? 0) < sinceSec) continue;
      spent += p.cost ?? 0;
      if (p.pricing_category === "MARKETING") marketing += p.volume ?? 0;
    }
  }
  return { spent: Math.round(spent * 100) / 100, marketing };
}

export type Balance = { amount: number; at: string };

/** India marketing rate seen on this account (₹0.8631), used before any spend exists. */
export const DEFAULT_RATE = 0.86;
/** Below this the balance shows red. */
export const LOW_BALANCE = 50;

export function parseBalance(value: unknown): Balance | null {
  const v = value as Partial<Balance> | null;
  if (typeof v?.amount !== "number" || v.amount <= 0 || Number.isNaN(Date.parse(v.at ?? ""))) return null;
  return { amount: v.amount, at: v.at as string };
}

/** The Meta balance last entered, minus what Meta reports spent since that day. */
export function computeBalance(input: { baseline: number; spent: number; marketing: number }) {
  const left = Math.max(0, Math.round((input.baseline - input.spent) * 100) / 100);
  const perMessage =
    input.marketing > 0 ? Math.round((input.spent / input.marketing) * 100) / 100 : DEFAULT_RATE;
  return { left, perMessage, messagesLeft: Math.floor(left / perMessage), low: left < LOW_BALANCE };
}

/** 131042 is Meta's payment failure; the latest marketing send tells us if funds ran out. */
export function fundsStatus(latest: { failureCode: string | null } | null): "ok" | "out" | "unknown" {
  if (!latest) return "unknown";
  return latest.failureCode === "131042" ? "out" : "ok";
}
