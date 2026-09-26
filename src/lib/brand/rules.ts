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
  "131049": "Meta ne roka (marketing limit)",
  "131026": "Is number pe WhatsApp nahi hai / message nahi pahuncha",
  "131050": "User ne marketing messages band kiye hain",
  "131042": "Payment ki dikkat – Meta billing check karo",
  "131047": "24 ghante ki window band",
  "130472": "Meta experiment ki wajah se roka",
};

export function failureReason(code: string | null): string {
  if (!code) return "Meta ne bheja nahi";
  return REASONS[code] ?? `Meta ne bheja nahi (code ${code})`;
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
