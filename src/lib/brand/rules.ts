/** Pure rules for the brand panel. No database, no network. */

export type BrandPayload = {
  kind: "brand";
  template: string;
  image: string;
  name: string;
  /** Id of the failed message this one re-sends. */
  retryOf?: string;
};

export function isBrandReply(text: string, replyId?: string | null): boolean {
  return [text, replyId].some((v) => (v ?? "").trim().toUpperCase() === "BRAND");
}

export const RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * 131049 is Meta's per-user marketing limit; Meta advises waiting a day.
 * Only a first attempt is retried, so a number is never tried a third time.
 */
export function retryDueAt(
  failureCode: string | undefined,
  payload: unknown,
  failedAt: Date,
): Date | null {
  if (failureCode !== "131049") return null;
  const p = payload as Partial<BrandPayload> | null;
  if (p?.kind !== "brand" || p.retryOf) return null;
  return new Date(failedAt.getTime() + RETRY_AFTER_MS);
}

const REASONS: Record<string, string> = {
  "131049": "Blocked by Meta (marketing limit for this person)",
  "131026": "Not on WhatsApp, or the message could not be delivered",
  "131050": "This person turned off marketing messages",
  "131042": "Payment problem – check Meta billing",
  "131047": "24-hour reply window has closed",
  "130472": "Held back by a Meta experiment",
};

export function failureReason(code: string | null): string {
  if (!code) return "Not delivered by Meta";
  return REASONS[code] ?? `Not delivered by Meta (code ${code})`;
}

export function failureAction(code: string | null, retryDueAt: Date | null): "auto" | "resend" | "none" {
  if (code === "131050") return "none";
  if (retryDueAt) return "auto";
  return "resend";
}

/**
 * Screen rows → the "name,number" lines `parseNumberList` reads. The number is
 * the last field there, so a name with a comma survives. Empty rows drop out.
 */
export function rowsToText(rows: { name: string; number: string }[]): string {
  return rows
    .filter((r) => r.number.trim() !== "")
    .map((r) => `${r.name.trim()},${r.number.trim()}`)
    .join("\n");
}

export function isFirstBrandTap(qualifiedAt: Date | null): boolean {
  return qualifiedAt === null;
}
