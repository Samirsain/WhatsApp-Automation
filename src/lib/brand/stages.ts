/** Where a BRAND lead stands with the team. Mirrors the LeadStage enum in the schema. */
export const LEAD_STAGES = ["NEW", "INTERESTED", "ONBOARDING", "NOT_INTERESTED"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  INTERESTED: "Interested",
  ONBOARDING: "Onboarding",
  NOT_INTERESTED: "Not interested",
};

/** What each status means and what the CRM team does next; shown on Final Leads. */
export const STAGE_HINTS: Record<LeadStage, { meaning: string; next: string }> = {
  NEW: { meaning: "Tapped Member, nobody has contacted them yet", next: "Call or WhatsApp them" },
  INTERESTED: { meaning: "Talked, wants to join", next: "Follow up and send the details" },
  ONBOARDING: { meaning: "Joining is in progress", next: "Finish their setup" },
  NOT_INTERESTED: { meaning: "Said no", next: "Nothing; kept for the record" },
};

export function parseStage(value: string | null | undefined): LeadStage | null {
  return LEAD_STAGES.includes(value as LeadStage) ? (value as LeadStage) : null;
}
