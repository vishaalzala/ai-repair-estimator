import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const estimateCategoryCodes = [
  "rr",
  "align",
  "cut_weld",
  "repair",
  "paint",
  "blend",
  "parts",
  "mechanical",
  "electrical",
  "diagnostics",
  "adas",
  "srs",
  "outwork",
  "panel_materials",
  "paint_materials",
  "consumables",
  "grooming",
  "miscellaneous",
] as const;

export const AiEstimateDraftSchema = z.object({
  summary: z.string().min(1),
  vehicleIdentification: z.object({
    registration: z.string().nullable(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    variant: z.string().nullable(),
    modelYear: z.number().int().min(1900).max(2100).nullable(),
    bodyType: z.string().nullable(),
    colour: z.string().nullable(),
    confidence: z.number().min(0).max(1),
    evidenceNote: z.string().nullable(),
  }),
  operations: z.array(z.object({
    categoryCode: z.enum(estimateCategoryCodes),
    component: z.string().min(1),
    side: z.enum(["LH", "RH", "FRONT", "REAR", "CENTRE", "NA"]).nullable(),
    operationCode: z.enum([
      "R&R",
      "REPAIR",
      "REPLACE",
      "PAINT",
      "BLEND",
      "ALIGN",
      "CUT&WELD",
      "MECHANICAL",
      "ELECTRICAL",
      "DIAGNOSTIC",
      "ADAS",
      "SRS",
      "OUTWORK",
      "MATERIAL",
      "GROOM",
      "INSPECT",
    ]),
    description: z.string().min(1),
    quantity: z.number().min(0.01).max(100),
    labourHours: z.number().min(0).max(100),
    suggestedAmount: z.number().min(0).max(100000).nullable(),
    confidence: z.number().min(0).max(1),
    reportSelected: z.boolean(),
    blendSelected: z.boolean(),
    pricingStatus: z.enum(["rate_card", "parts_tbc", "manual_tbc", "ai_estimate", "included"]),
    notes: z.string().nullable(),
  })).min(1).max(160),
  inspectionNotes: z.array(z.string()).max(30),
  estimatorNotes: z.array(z.string()).max(30),
});

export type AiEstimateDraft = z.infer<typeof AiEstimateDraftSchema>;

export type EstimatePhotoInput = {
  id: string;
  signedUrl: string;
  category: string;
  fileName: string;
};

export async function generateRepairEstimateDraft(input: {
  model: string;
  vehicleContext: string;
  claimContext: string;
  damageContext: string;
  workshopContext: string;
  knowledgeContext: string;
  photos?: EstimatePhotoInput[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.model) throw new Error("AI_ESTIMATE_MODEL is not configured");

  const client = new OpenAI({ apiKey });
  const photos = input.photos ?? [];
  const photoLegend = photos.length
    ? photos.map((photo, index) => `Photo ${index + 1}: id=${photo.id}; category=${photo.category}; file=${photo.fileName}`).join("\n")
    : "The visible-damage findings below were produced by the immediately preceding vision analysis of the job photos.";

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "high" }
  > = [
    {
      type: "input_text",
      text: [
        "VEHICLE CONTEXT",
        input.vehicleContext,
        "\nJOB / CLAIM NOTES",
        input.claimContext,
        "\nVISIBLE-DAMAGE FINDINGS FROM PHOTO ANALYSIS",
        input.damageContext || "No previous damage findings recorded.",
        "\nWORKSHOP ESTIMATING CONFIGURATION",
        input.workshopContext,
        "\nWORKSHOP / USER KNOWLEDGE",
        input.knowledgeContext || "No extra knowledge supplied.",
        "\nPHOTO CONTEXT",
        photoLegend,
        "\nCreate a complete preliminary repair estimate from this evidence and the estimator note. The application will apply configured workshop rates deterministically after your operation list is returned.",
      ].join("\n"),
    },
    ...photos.map((photo) => ({
      type: "input_image" as const,
      image_url: photo.signedUrl,
      detail: "high" as const,
    })),
  ];

  const response = await client.responses.parse({
    model: input.model,
    instructions: [
      "You are a senior New Zealand collision-repair estimator preparing a PRELIMINARY workshop estimate from vehicle photo evidence and estimator notes.",
      "The estimate must follow the workshop's Insurance-project style: every physical operation or component is its own line. Never combine multiple remove/refit items, multiple parts, or multiple repair actions into one long sentence separated by commas or semicolons.",
      "Examples of the required granularity: Front bumper; Front bumper grille lower; Front bumper grille upper; headlamp LH; bumper absorber; bumper retainer LH; guard liner; guard moulding. Each should be a separate line when relevant.",
      "Return a comprehensive operation list, not merely a damage description. Include legitimate remove/refit, repair, paint, blend, parts, mechanical/electrical/diagnostic/ADAS/SRS, outwork and materials operations when supported or necessary for the stated repair.",
      "The supplied visible-damage findings are trusted as the output of the immediately preceding vision pass, but they remain preliminary and human-reviewable.",
      "Use category code rr for Remove & Refit, repair for panel/plastic repair, paint for refinishing, parts for replacement parts, and blend for a blend operation. The application displays blend inside Paint.",
      "For a repaired painted component, normally include separate repair and paint lines. Include each necessary remove/refit operation needed to carry out that repair as a separate line when reasonably supported by normal collision-estimating practice.",
      "Workshop rule: when a front bumper is being refinished, consider both adjoining front guards for blend. Include separate blend lines when appropriate; do not bury blend inside another paint description.",
      "Replacement parts must use operationCode REPLACE, pricingStatus parts_tbc and suggestedAmount null. Never invent a part price, part number or supplier price. Parts remain TBC/PartsTrader until a real supplier price exists.",
      "For hourly categories, every chargeable rate_card line must have realistic non-zero labourHours. Prefer practical workshop increments such as 0.1, 0.2, 0.25, 0.4, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0 or 5.0 hours. At a $120/hr rate these correspond to the historic estimating pattern of $12, $24, $30, $48, $60, $90, $120, $180, $240, $300, $360, $480 and $600.",
      "Use the configured fixed workshop rates for paint and blend. labourHours should normally be 0 for paint/blend because the application applies the fixed panel/blend rate.",
      "For outwork, panel materials, paint materials, consumables, grooming or miscellaneous: if workshop knowledge/history gives a reasonable preliminary amount, set pricingStatus ai_estimate and suggestedAmount to that preliminary amount. Otherwise use manual_tbc and suggestedAmount null. Clearly identify estimates in notes. Do not use ai_estimate for parts.",
      "Do not invent hidden structural, SRS, mechanical or ADAS damage. If something cannot be confirmed from the evidence, put it in inspectionNotes rather than charging for a replacement.",
      "You may include diagnostic/ADAS inspection operations only when the visible repair area or supplied context provides a reasonable basis. Be conservative.",
      "Do not invent insurer requirements or OEM procedures. Do not invent customer or owner details.",
      "For trial fitting, gap checking, decal/livery removal/reinstatement, scans, towing or specialist sublet work, create distinct lines in the correct section rather than folding them into another description.",
      "Set reportSelected true for operations that should appear on the repair report. Set blendSelected true only for blend operations.",
      "LH and RH always mean the vehicle's perspective, never the viewer's perspective.",
      "Do not duplicate any existing manual or human-verified estimate line described in the workshop context.",
      "Vehicle identification may be populated only from supplied vehicle/photo-analysis context. Use null for uncertain fields and do not guess VIN, model year, customer or owner information.",
      "The goal is a complete first-pass AI estimate with realistic labour and configured paint/blend pricing, while keeping uncertain parts and unsupported external costs explicitly TBC.",
      "The human estimator must be able to review and edit every generated line before the estimate is issued.",
    ].join("\n"),
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(AiEstimateDraftSchema, "repair_estimate_draft") },
  });

  if (!response.output_parsed) throw new Error("OpenAI did not return a structured repair estimate");
  const draft = AiEstimateDraftSchema.parse(response.output_parsed);

  return {
    draft,
    responseId: response.id,
    usage: {
      inputTokens: response.usage?.input_tokens ?? null,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
}
