import { leadId } from "@/lib/lead-id";

/** What the Funnel and Not Interested pages show for a delivery status: only three words. */
export type DeliveryLabel = "Not delivered" | "Delivered" | "Seen";

export function deliveryLabel(status: string): DeliveryLabel {
  if (status === "READ") return "Seen";
  if (status === "DELIVERED") return "Delivered";
  // QUEUED and SENT have not reached the phone yet; FAILED never will.
  return "Not delivered";
}

type Searchable = { leadNumber: number; name: string | null; phoneE164: string };

/**
 * Search box match: name (any case), number (digits only, so "+91 98" and
 * "9198" both work) or lead ID ("L-0042", "l42" or just "42").
 */
export function matchesSearch(c: Searchable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (c.name?.toLowerCase().includes(q)) return true;
  if (leadId(c.leadNumber).toLowerCase() === q) return true;
  const idDigits = q.replace(/^l-?/, "");
  if (/^\d+$/.test(idDigits) && Number(idDigits) === c.leadNumber) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length > 0 && c.phoneE164.replace(/\D/g, "").includes(digits);
}

/** Furthest along first (3/3, then 2/3, then 1/3); newest send first within a stage. */
export function byStageThenNewest(a: { step: number; createdAt: Date }, b: { step: number; createdAt: Date }): number {
  return b.step - a.step || b.createdAt.getTime() - a.createdAt.getTime();
}

export const stepOf = (payload: unknown): number => (payload as { step?: number } | null)?.step ?? 1;
