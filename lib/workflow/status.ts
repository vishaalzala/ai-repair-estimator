export const JOB_STATUSES = [
  "draft",
  "intake_complete",
  "photos_required",
  "ai_analysing",
  "damage_review",
  "estimating",
  "awaiting_parts",
  "ai_review",
  "ready_for_approval",
  "approved",
  "sent_to_insurer",
  "awaiting_response",
  "authorised",
  "revision_requested",
  "supplement_required",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const DAILY_JOB_STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "draft", label: "New" },
  { value: "intake_complete", label: "Intake Complete" },
  { value: "photos_required", label: "Photos Required" },
  { value: "ai_analysing", label: "AI Analysing" },
  { value: "damage_review", label: "Damage Review" },
  { value: "estimating", label: "Estimating" },
  { value: "awaiting_parts", label: "Awaiting Parts" },
  { value: "ai_review", label: "AI Review" },
  { value: "ready_for_approval", label: "Ready for Approval" },
  { value: "approved", label: "Approved" },
  { value: "sent_to_insurer", label: "Sent to Insurer" },
  { value: "awaiting_response", label: "Awaiting Insurer" },
  { value: "authorised", label: "Authorised" },
  { value: "revision_requested", label: "Revision Required" },
  { value: "supplement_required", label: "Supplement" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function isJobStatus(value: string): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}

export function jobStatusLabel(value: string) {
  return DAILY_JOB_STATUS_OPTIONS.find((status) => status.value === value)?.label
    ?? value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
