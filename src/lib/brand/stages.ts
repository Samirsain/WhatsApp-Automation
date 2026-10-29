/** Where a BRAND lead stands with the team. Mirrors the LeadStage enum in the schema. */
export const LEAD_STAGES = ["NEW", "NOT_INTERESTED", "MEMBER_ADDED"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  NOT_INTERESTED: "Not interested",
  MEMBER_ADDED: "Member added",
};

/** What each status means and what the CRM team does next; shown on Final Leads. */
export const STAGE_HINTS: Record<LeadStage, { meaning: string; next: string }> = {
  NEW: { meaning: "Tapped Member, nobody has contacted them yet", next: "Call or WhatsApp them" },
  NOT_INTERESTED: { meaning: "Said no", next: "Nothing; kept for the record" },
  MEMBER_ADDED: { meaning: "Joined the club", next: "Nothing; they are in" },
};

export function parseStage(value: string | null | undefined): LeadStage | null {
  return LEAD_STAGES.includes(value as LeadStage) ? (value as LeadStage) : null;
}
