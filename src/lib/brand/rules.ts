/** Pure rules for the brand panel. No database, no network. */
import type { FunnelStep } from "./templates";


export type BrandPayload = {
  kind: "brand";
  template: string;
  image: string;
  name: string;
  /** Funnel step; missing on sends from before the funnel (treated as 1). */
  step?: FunnelStep;
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

const DAY = 24 * 60 * 60 * 1000;
/** How long after a step went out, with no reply, the next one (or the red mark) is due. */
export const FOLLOW_UP_AFTER_MS: Record<FunnelStep, number> = { 1: 3 * DAY, 2: 2 * DAY, 3: 2 * DAY };

/** What a due funnel step leads to. Anything since (a reply, a newer send) ends the chain. */
export function nextFunnelAction(
  step: FunnelStep,
  state: { anythingSince: boolean; failed: boolean; brandLead: boolean; optedOut: boolean },
): "skip" | "red" | FunnelStep {
  if (state.anythingSince || state.failed || state.brandLead || state.optedOut) return "skip";
  return step === 3 ? "red" : ((step + 1) as FunnelStep);
}

const REASONS: Record<string, string> = {
  "131049": "Blocked by Meta (marketing limit for this person)",
  "131026": "Not on WhatsApp, or the message could not be delivered",
  "131050": "This person turned off marketing messages",
  "131042": "Payment problem – check Meta billing",
  "131047": "24-hour reply window has closed",
  "130472": "Held back by a Meta experiment",
  "190": "WhatsApp access token expired or invalid – update WHATSAPP_ACCESS_TOKEN in Railway",
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

/** Split one CSV line on `delimiter`, honouring double quotes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { fields.push(field); field = ""; }
    else field += ch;
  }
  fields.push(field);
  return fields.map((f) => f.trim());
}

/**
 * An uploaded CSV → name/number rows. The number is the last column that looks
 * like a phone, so extra columns (city, trailing empties) do not matter; the
 * name is everything before it. Lines without a number are counted as skipped.
 */
export function parseCsvRows(text: string): { rows: { name: string; number: string }[]; skipped: number } {
  const rows: { name: string; number: string }[] = [];
  let skipped = 0;
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const fields = splitCsvLine(line, line.includes(",") ? "," : ";");
    let idx = -1;
    for (let i = fields.length - 1; i >= 0; i--) {
      if (fields[i].replace(/\D/g, "").length >= 10) { idx = i; break; }
    }
    if (idx === -1) { skipped++; continue; }
    rows.push({ name: fields.slice(0, idx).filter(Boolean).join(", "), number: fields[idx] });
  }
  return { rows, skipped };
}

/**
 * One CSV cell. Values starting with = + - @ are prefixed with ' so a
 * spreadsheet shows them as text instead of running them — names come from
 * WhatsApp profiles, which anyone can set — and a phone stays a phone.
 */
export function csvCell(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

