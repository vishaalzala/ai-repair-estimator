export type AiWorkload =
  | "intake"
  | "damage"
  | "estimate"
  | "review"
  | "document"
  | "training"
  | "learning";

function env(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

export function modelFor(workload: AiWorkload) {
  switch (workload) {
    case "intake":
      return env("AI_INTAKE_MODEL") ?? env("AI_DAMAGE_MODEL") ?? "gpt-5.6-luna";
    case "damage":
      return env("AI_DAMAGE_MODEL") ?? "gpt-5.6-luna";
    case "estimate":
      return env("AI_ESTIMATE_MODEL") ?? "gpt-5.6-terra";
    case "review":
      return env("AI_REVIEW_MODEL") ?? "gpt-5.6-terra";
    case "document":
      return env("AI_DOCUMENT_MODEL") ?? "gpt-5.6-luna";
    case "training":
      return env("AI_TRAINING_MODEL") ?? env("AI_DOCUMENT_MODEL") ?? "gpt-5.6-terra";
    case "learning":
      return env("AI_LEARNING_MODEL") ?? "gpt-5.6-luna";
  }
}

export function escalationModel() {
  return env("AI_ESCALATION_MODEL") ?? "gpt-5.6-sol";
}

export function estimateModelForDamage(input: {
  severity?: string | null;
  vehicleConfidence?: number | null;
  findingCount?: number;
  lowConfidenceFindings?: number;
  structuralFinding?: boolean;
}) {
  const standard = modelFor("estimate");
  const escalation = escalationModel();

  const veryLowIdentity = Number(input.vehicleConfidence ?? 1) < 0.45;
  const manyFindings = Number(input.findingCount ?? 0) >= 18;
  const manyUncertain = Number(input.lowConfidenceFindings ?? 0) >= 5;
  const majorStructural = input.severity === "major" && Boolean(input.structuralFinding);

  if (veryLowIdentity || manyFindings || manyUncertain || majorStructural) {
    return {
      model: escalation,
      tier: "escalated" as const,
      reason: veryLowIdentity
        ? "very_low_vehicle_confidence"
        : manyFindings
          ? "high_finding_count"
          : manyUncertain
            ? "many_low_confidence_findings"
            : "major_structural_damage",
    };
  }

  return { model: standard, tier: "standard" as const, reason: "normal_estimate" };
}

export const AI_PROMPT_CACHE_KEYS = {
  intake: "repairquote:intake:v2",
  damage: "repairquote:damage:v2",
  estimate: "repairquote:estimate:v3",
  review: "repairquote:review:v2",
  document: "repairquote:document:v2",
  training: "repairquote:training:v2",
} as const;
