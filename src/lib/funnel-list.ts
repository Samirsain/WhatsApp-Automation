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
 * How well a row matches the search box; 0 = no match. Name (any case),
 * number (digits only, so "+91 98" and "9198" both work) or lead ID
 * ("L-0042", "l42" or just "42"). Higher is better, so the closest
 * matches go to the top:
 *   4  exact lead ID, or the whole number
 *   3  name or number starts with it (number with or without +91)
 *   2  a word in the name starts with it
 *   1  anywhere in the name or number
 */
export function searchScore(c: Searchable, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const idDigits = q.replace(/^l-?/, "");
  if (leadId(c.leadNumber).toLowerCase() === q || (/^l-?\d+$/.test(q) && Number(idDigits) === c.leadNumber)) return 4;

  const digits = q.replace(/\D/g, "");
  const phone = c.phoneE164.replace(/\D/g, "");
  const local = phone.replace(/^91(?=\d{10}$)/, "");
  const name = c.name?.toLowerCase() ?? "";
  // Mostly digits = a number search; "Riya 2" style text still searches the name.
  const numberSearch = digits.length > 0 && digits.length >= q.replace(/[\s+\-()]/g, "").length;

  let score = 0;
  if (numberSearch) {
    if (digits === phone || digits === local) score = 4;
    else if (phone.startsWith(digits) || local.startsWith(digits)) score = 3;
    else if (phone.includes(digits)) score = 1;
    if (/^\d+$/.test(q) && Number(q) === c.leadNumber) score = Math.max(score, 2);
  }
  if (name.startsWith(q)) score = Math.max(score, 3);
  else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = Math.max(score, 2);
  else if (name.includes(q)) score = Math.max(score, 1);
  return score;
}

export function matchesSearch(c: Searchable, query: string): boolean {
  return searchScore(c, query) > 0;
}

/** Rows matching the search, best match first; ties keep the order they came in. */
export function search<T>(rows: T[], query: string, of: (row: T) => Searchable): T[] {
  if (!query.trim()) return rows;
  return rows
    .map((r, i) => ({ r, i, s: searchScore(of(r), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r);
}

/**
 * Where to highlight the query in a shown value: [start, end) or null. For a
 * number the digits are matched through spaces and "+", like the search.
 */
export function matchRange(text: string, query: string, kind: "name" | "number"): [number, number] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (kind === "name") {
    const at = text.toLowerCase().indexOf(q);
    return at >= 0 ? [at, at + q.length] : null;
  }
  const digits = q.replace(/\D/g, "");
  if (!digits || digits.length < q.replace(/[\s+\-()]/g, "").length) return null;
  const positions = [...text].flatMap((ch, i) => (/\d/.test(ch) ? [i] : []));
  const at = positions.map((i) => text[i]).join("").indexOf(digits);
  return at >= 0 ? [positions[at], positions[at + digits.length - 1] + 1] : null;
}

/** Furthest along first (3/3, then 2/3, then 1/3); newest send first within a stage. */
export function byStageThenNewest(a: { step: number; createdAt: Date }, b: { step: number; createdAt: Date }): number {
  return b.step - a.step || b.createdAt.getTime() - a.createdAt.getTime();
}

export const stepOf = (payload: unknown): number => (payload as { step?: number } | null)?.step ?? 1;
