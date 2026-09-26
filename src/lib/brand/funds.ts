/**
 * Pure funds arithmetic. Meta does not expose the prepaid WhatsApp balance
 * outside Business Solution Providers, so the balance is an estimate:
 * top-ups entered by staff minus the spend Meta reports in pricing_analytics.
 */

export type Topup = { amount: number; at: string };

/** India marketing rate seen on this account (₹0.8631), used before any spend exists. */
export const DEFAULT_RATE = 0.86;

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

export function parseTopups(value: unknown): Topup[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (t): t is Topup =>
      typeof t?.amount === "number" && t.amount > 0 && !Number.isNaN(Date.parse(t?.at)),
  );
}

type Analytics = {
  pricing_analytics?: {
    data?: { data_points?: { pricing_category?: string; volume?: number; cost?: number }[] }[];
  };
};

export function sumSpend(body: Analytics): { spent: number; marketing: number } {
  let spent = 0;
  let marketing = 0;
  for (const d of body.pricing_analytics?.data ?? []) {
    for (const p of d.data_points ?? []) {
      spent += p.cost ?? 0;
      if (p.pricing_category === "MARKETING") marketing += p.volume ?? 0;
    }
  }
  return { spent: Math.round(spent * 10000) / 10000, marketing };
}

export function computeFunds(input: { added: number; spent: number; marketing: number }) {
  const left = Math.max(0, Math.round((input.added - input.spent) * 100) / 100);
  const perMessage =
    input.marketing > 0 ? Math.round((input.spent / input.marketing) * 100) / 100 : DEFAULT_RATE;
  return { added: input.added, spent: input.spent, left, perMessage, messagesLeft: Math.floor(left / perMessage) };
}
