export type RuleContext = Record<string, unknown>;

export type RuleCondition = {
  field?: string;
  operator?: "equals" | "truthy" | "contains_any" | "contains_all" | "not_contains_any";
  value?: unknown;
  all?: RuleCondition[];
  any?: RuleCondition[];
};

export type RuleAction = {
  check_type: string;
  title: string;
  detail?: string;
  severity: "pass" | "information" | "review" | "blocking";
};

export type RuleForEvaluation = {
  id: string;
  code: string;
  name: string;
  enforcement_level: string;
  conditions: RuleCondition;
  actions: RuleAction[];
};

export type EvaluatedRuleCheck = RuleAction & {
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  enforcementLevel: string;
};

function getPath(context: RuleContext, path: string) {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, context);
}

function normalizedText(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(" ").toLowerCase();
  return String(value ?? "").toLowerCase();
}

function values(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item).toLowerCase()) : [String(value ?? "").toLowerCase()];
}

export function matchesCondition(condition: RuleCondition, context: RuleContext): boolean {
  if (condition.all) return condition.all.every((child) => matchesCondition(child, context));
  if (condition.any) return condition.any.some((child) => matchesCondition(child, context));
  if (!condition.field || !condition.operator) return false;

  const actual = getPath(context, condition.field);
  switch (condition.operator) {
    case "equals":
      return actual === condition.value;
    case "truthy":
      return Boolean(actual);
    case "contains_any": {
      const haystack = normalizedText(actual);
      return values(condition.value).some((needle) => needle.length > 0 && haystack.includes(needle));
    }
    case "contains_all": {
      const haystack = normalizedText(actual);
      return values(condition.value).every((needle) => needle.length > 0 && haystack.includes(needle));
    }
    case "not_contains_any": {
      const haystack = normalizedText(actual);
      return values(condition.value).every((needle) => !needle || !haystack.includes(needle));
    }
    default:
      return false;
  }
}

export function evaluateRules(rules: RuleForEvaluation[], context: RuleContext): EvaluatedRuleCheck[] {
  return rules.flatMap((rule) => {
    if (!matchesCondition(rule.conditions, context)) return [];
    return rule.actions.map((action) => ({
      ...action,
      ruleId: rule.id,
      ruleCode: rule.code,
      ruleName: rule.name,
      enforcementLevel: rule.enforcement_level,
    }));
  });
}
