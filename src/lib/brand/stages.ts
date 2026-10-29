/** Where a BRAND lead stands with the team. Mirrors the LeadStage enum in the schema. */
export const LEAD_STAGES = ["NEW", "NOT_INTERESTED", "MEMBER_ADDED"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  NOT_INTERESTED: "Not interested",
  MEMBER_ADDED: "Member added",
};

export function parseStage(value: string | null | undefined): LeadStage | null {
  return LEAD_STAGES.includes(value as LeadStage) ? (value as LeadStage) : null;
}
