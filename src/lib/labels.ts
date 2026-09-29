/** The five statuses a number can be in. */
export const CUSTOMER_STATUS_LABELS = {
  NOT_STARTED: "Not started",
  IN_FUNNEL: "In funnel",
  QUALIFIED: "Qualified",
  NOT_INTERESTED: "Not interested",
  NO_RESPONSE: "No response",
} as const;

export type CustomerStatusKey = keyof typeof CUSTOMER_STATUS_LABELS;

/** The colour each status carries in bars and meters, matching its badge. */
export const CUSTOMER_STATUS_COLOR: Record<CustomerStatusKey, string> = {
  NOT_STARTED: "var(--color-border-default)",
  IN_FUNNEL: "var(--color-status-info)",
  QUALIFIED: "var(--color-status-success)",
  NOT_INTERESTED: "var(--color-status-error)",
  NO_RESPONSE: "var(--color-status-warning)",
};

export const BATCH_STATUS_LABELS = {
  DRAFT: "Draft",
  RUNNING: "Running",
  PAUSED: "Paused",
  STOPPED: "Stopped",
  COMPLETED: "Completed",
} as const;

export const AUTOMATION_STATUS_LABELS = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  DISABLED: "Disabled",
} as const;

type Tone = "neutral" | "success" | "warning" | "error" | "info";

export function statusTone(status: string): Tone {
  switch (status) {
    case "QUALIFIED":
    case "ACTIVE":
    case "RUNNING":
    case "COMPLETED":
    case "DELIVERED":
    case "READ":
      return "success";
    case "IN_FUNNEL":
    case "SENT":
    case "QUEUED":
      return "info";
    case "PAUSED":
    case "NO_RESPONSE":
      return "warning";
    case "NOT_INTERESTED":
    case "STOPPED":
    case "DISABLED":
    case "FAILED":
      return "error";
    default:
      return "neutral";
  }
}

/** "BATCH_COMPLETED" → "Batch completed": first letter capital, like every other label. */
export function sentenceCase(value: string): string {
  const words = value.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
