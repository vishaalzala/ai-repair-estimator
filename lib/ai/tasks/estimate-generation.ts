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
    confidence: z.number().min(0).max(1),
    reportSelected: z.boolean(),
    blendSelected: z.boolean(),
    pricingStatus: z.enum(["rate_card", "parts_tbc", "manual_tbc", "included"]),
    notes: z.string().nullable(),
  })).min(1).max(120),
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
  photos: EstimatePhotoInput[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.model) throw new Error("AI_ESTIMATE_MODEL is not configured");
  if (!input.photos.length) throw new Error("At least one evidence photo is required");

  const client = new OpenAI({ apiKey });
  const photoLegend = input.photos
    .map((photo, index) => `Photo ${index + 1}: id=${photo.id}; category=${photo.category}; file=${photo.fileName}`)
    .join("\n");

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
        "\nPREVIOUS DAMAGE FINDINGS",
        input.damageContext || "No previous damage findings recorded.",
        "\nWORKSHOP ESTIMATING CONFIGURATION",
        input.workshopContext,
        "\nWORKSHOP / USER KNOWLEDGE",
        input.knowledgeContext || "No extra knowledge supplied.",
        "\nPHOTO LEGEND",
        photoLegend,
        "\nCreate a complete preliminary repair estimate from the photos and notes. The application will apply configured prices deterministically after your operation list is returned.",
      ].join("\n"),
    },
    ...input.photos.map((photo) => ({
      type: "input_image" as const,
      image_url: photo.signedUrl,
      detail: "high" as const,
    })),
  ];

  const response = await client.responses.parse({
    model: input.model,
    instructions: [
      "You are a senior New Zealand collision-repair estimator preparing a PRELIMINARY workshop estimate from vehicle photographs and estimator notes.",
      "Return a comprehensive operation list, not merely a damage description. Include legitimate remove/refit, repair, paint, blend, parts, mechanical/electrical/diagnostic/ADAS/SRS, outwork and materials operations when supported or necessary for the stated repair.",
      "Use category code rr for Remove & Refit, repair for panel/plastic repair, paint for refinishing, and parts for replacement parts. Use blend for a blend operation; the application will display it in the Paint section.",
      "For a repaired painted component, normally include both the repair operation and its paint/refinish operation. Include necessary remove/refit operations required to carry out that repair when reasonably supported by normal estimating practice.",
      "Workshop rule: when a front bumper is being refinished, consider both adjoining front guards for blend. Include blend operations when appropriate for the workshop estimate; mark them BLEND.",
      "Replacement parts must use operationCode REPLACE and pricingStatus parts_tbc. Never invent a part price, part number or supplier price.",
      "Do not invent hidden structural, SRS, mechanical or ADAS damage. If something cannot be confirmed from the evidence, put it in inspectionNotes rather than charging for a replacement.",
      "You may include diagnostic/ADAS inspection operations only when the visible repair area or supplied context provides a reasonable basis. Be conservative.",
      "Do not invent insurer requirements or OEM procedures. Do not invent customer or owner details.",
      "Labour hours are preliminary estimator suggestions. Keep them realistic and proportionate to the visible repair. Pricing is applied later from the workshop rate card.",
      "For paint or blend, labourHours should normally be 0 because the workshop uses configured fixed panel rates. For parts, part price remains TBC and labourHours should only represent a separate fitting labour operation if one is genuinely needed; otherwise use a separate rr/mechanical line.",
      "For materials or outwork without a configured deterministic amount, use pricingStatus manual_tbc rather than inventing a charge.",
      "Set reportSelected true for operations that should appear on the repair report. Set blendSelected true only for blend operations.",
      "LH and RH always mean the vehicle's perspective, never the viewer's perspective.",
      "Vehicle identification may be populated only from visible badges/registration/evidence. Do not guess VIN or a model year that cannot be supported. Use null for uncertain fields and lower confidence.",
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
