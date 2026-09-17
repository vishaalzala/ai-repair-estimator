import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AI_PROMPT_CACHE_KEYS } from "@/lib/ai/model-policy";

export const EstimateReviewSchema = z.object({
  summary: z.string().min(1),
  checks: z.array(z.object({
    checkType: z.string().min(1),
    title: z.string().min(1),
    detail: z.string().min(1),
    severity: z.enum(["information", "review", "blocking"]),
    confidence: z.number().min(0).max(1),
    recommendation: z.enum(["review_addition", "review_edit", "inspection_only", "consistency_check"]),
    rationale: z.string().min(1),
    sourceRefs: z.array(z.string()).max(15),
    relatedEstimateItemIds: z.array(z.string()).max(20),
  })).max(40),
});

export type EstimateReview = z.infer<typeof EstimateReviewSchema>;

export async function reviewRepairEstimate(input: {
  model: string;
  vehicleContext: string;
  claimContext: string;
  damageContext: string;
  estimateContext: string;
  partsContext: string;
  ruleContext: string;
  knowledgeContext: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.model) throw new Error("AI_REVIEW_MODEL is not configured");

  const client = new OpenAI({ apiKey });
  const response = await client.responses.parse({
    model: input.model,
    reasoning: { effort: "low" },
    prompt_cache_key: AI_PROMPT_CACHE_KEYS.review,
    max_output_tokens: 5000,
    instructions: [
      "You are a second-pass automotive repair estimate reviewer for a professional collision/mechanical workshop.",
      "Your job is to identify legitimate operations, inspections, dependencies or consistency issues the human estimator should REVIEW because they may be missing.",
      "Do not invent charges, labour times, part prices, hidden damage, insurer rules or OEM procedures that are not supported by the supplied context.",
      "Do not calculate totals. Pricing is owned by a deterministic pricing engine.",
      "Avoid duplicates: if an operation is already present in the estimate, do not recommend adding it again. You may flag an inconsistency if needed.",
      "If evidence is weak, recommend inspection/check-after-strip rather than a billable addition.",
      "Treat pending AI damage findings as unverified. Human-accepted findings have more weight.",
      "ADAS/SRS/structural topics require conservative review wording and must not be asserted as damaged without evidence.",
      "Use sourceRefs exactly as provided in the context when a check depends on workshop/global knowledge or a deterministic rule.",
      "The human estimator makes every final decision.",
    ].join("\n"),
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: [
          "VEHICLE", input.vehicleContext,
          "\nCLAIM", input.claimContext,
          "\nDAMAGE FINDINGS", input.damageContext,
          "\nCURRENT ESTIMATE", input.estimateContext,
          "\nPARTS STATUS", input.partsContext,
          "\nDETERMINISTIC RULE CHECKS", input.ruleContext,
          "\nRETRIEVED KNOWLEDGE", input.knowledgeContext,
          "\nReview the estimate for possible legitimate omissions or unresolved checks. Return only structured review checks; never alter the estimate.",
        ].join("\n"),
      }],
    }],
    text: { format: zodTextFormat(EstimateReviewSchema, "repair_estimate_review") },
  });

  if (!response.output_parsed) throw new Error("OpenAI did not return a structured estimate review");
  const analysis = EstimateReviewSchema.parse(response.output_parsed);
  return {
    review: analysis,
    responseId: response.id,
    usage: {
      inputTokens: response.usage?.input_tokens ?? null,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
}
