import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AI_PROMPT_CACHE_KEYS } from "@/lib/ai/model-policy";

const nullableConfidence = z.number().min(0).max(1);

export const VehicleIntakeSchema = z.object({
  vehicle: z.object({
    registration: z.string().nullable(),
    vin: z.string().nullable(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    variant: z.string().nullable(),
    modelYear: z.number().int().min(1900).max(2100).nullable(),
    colour: z.string().nullable(),
    paintCode: z.string().nullable(),
    odometerKm: z.number().int().min(0).nullable(),
    bodyType: z.string().nullable(),
    fuelType: z.string().nullable(),
    isEv: z.boolean().nullable(),
    isHybrid: z.boolean().nullable(),
    adasPresent: z.boolean().nullable(),
  }),
  confidence: z.object({
    registration: nullableConfidence,
    vin: nullableConfidence,
    make: nullableConfidence,
    model: nullableConfidence,
    variant: nullableConfidence,
    modelYear: nullableConfidence,
    colour: nullableConfidence,
    paintCode: nullableConfidence,
    odometerKm: nullableConfidence,
    bodyType: nullableConfidence,
    fuelType: nullableConfidence,
    isEv: nullableConfidence,
    isHybrid: nullableConfidence,
    adasPresent: nullableConfidence,
  }),
  photoClassifications: z.array(z.object({
    photoId: z.string(),
    category: z.enum(["identification", "accident_damage", "pre_existing", "hidden_damage", "extra_damage", "strip_down", "progress", "parts", "completed", "document"]),
    confidence: z.number().min(0).max(1),
  })).max(20),
  visibleDamage: z.array(z.object({
    component: z.string().min(1),
    side: z.enum(["LH", "RH", "FRONT", "REAR", "CENTRE", "NA"]).nullable(),
    observedDamage: z.string().min(1),
    suggestedAction: z.enum(["REPAIR", "REPLACE", "R&R", "TRANSFER", "PAINT", "BLEND", "CUT&WELD", "ALIGN", "CHECK_AFTER_STRIP", "OUTWORK", "TBC", "INSPECT"]),
    confidence: z.number().min(0).max(1),
    evidencePhotoIds: z.array(z.string()).min(1),
  })).max(60),
  suggestedOperations: z.array(z.object({
    categoryCode: z.enum(["rr", "align", "cut_weld", "repair", "paint", "blend", "parts", "mechanical", "electrical", "diagnostics", "adas", "srs", "outwork", "panel_materials", "paint_materials", "consumables", "grooming", "miscellaneous"]),
    component: z.string().nullable(),
    side: z.enum(["LH", "RH", "FRONT", "REAR", "CENTRE", "NA"]).nullable(),
    description: z.string().min(1),
    confidence: z.number().min(0).max(1),
    evidencePhotoIds: z.array(z.string()).min(1),
  })).max(80),
  summary: z.string().min(1),
  warnings: z.array(z.string()).max(30),
});

export type VehicleIntakeAnalysis = z.infer<typeof VehicleIntakeSchema>;

export type VehicleIntakePhoto = {
  id: string;
  signedUrl: string;
  category: string;
  fileName: string;
};

export type VehicleIntakeHints = {
  registration?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  modelYear?: number | null;
  accidentDescription?: string | null;
};

export async function analyzeVehicleIntake(input: {
  model: string;
  hints: VehicleIntakeHints;
  photos: VehicleIntakePhoto[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.model) throw new Error("AI_INTAKE_MODEL is not configured");
  if (!input.photos.length) throw new Error("At least one vehicle photo is required");

  const client = new OpenAI({ apiKey });
  const hintText = [
    `Registration hint: ${input.hints.registration ?? "not provided"}`,
    `VIN hint: ${input.hints.vin ?? "not provided"}`,
    `Vehicle hint: ${[input.hints.modelYear, input.hints.make, input.hints.model, input.hints.variant].filter(Boolean).join(" ") || "not provided"}`,
    `User notes / accident description: ${input.hints.accidentDescription ?? "not provided"}`,
  ].join("\n");
  const rankedPhotos = [...input.photos].sort((a, b) => {
    const priority = (category: string) => category === "identification" || category === "document" ? 0 : category === "accident_damage" ? 1 : 2;
    return priority(a.category) - priority(b.category);
  });
  const visionPhotos = rankedPhotos.slice(0, 16);
  const highDetailIds = new Set(
    visionPhotos
      .filter((photo) => photo.category === "identification" || photo.category === "document")
      .slice(0, 2)
      .map((photo) => photo.id),
  );
  const photoLegend = visionPhotos.map((photo, index) => `Photo ${index + 1}: id=${photo.id}; current_category=${photo.category}; file=${photo.fileName}`).join("\n");

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" | "high" }
  > = [
    {
      type: "input_text",
      text: `${hintText}\n\nPHOTO LEGEND\n${photoLegend}\n\nExtract vehicle identity where supported by evidence, classify each photo, identify visible damage, and prepare preliminary estimating-operation suggestions for human review. Also record visible estimate-relevant attachments/accessories around the repair area (lamps, trims, mouldings, grilles, liners, sensors, badges, decals/livery, handles and similar items) when they may require removal, transfer, inspection or replacement to complete the repair.`,
    },
    ...visionPhotos.map((photo) => ({
      type: "input_image" as const,
      image_url: photo.signedUrl,
      detail: highDetailIds.has(photo.id) ? "high" as const : "low" as const,
    })),
  ];

  const response = await client.responses.parse({
    model: input.model,
    store: false,
    reasoning: { effort: "low" },
    prompt_cache_key: AI_PROMPT_CACHE_KEYS.intake,
    instructions: [
      "You assist a professional automotive repair estimator during photo-first intake.",
      "Use supplied photos and user-entered hints only. Do not use outside knowledge to invent identifiers or claim facts that are not supported.",
      "Registration, VIN, odometer and paint code must only be returned when legible in the evidence or explicitly supplied by the user.",
      "Make, model, variant and model year may be suggested from visible evidence, but lower confidence whenever uncertain and return null instead of guessing.",
      "Do not identify a person or infer a customer name from an image. Customer details are intentionally left empty during quick intake.",
      "Describe only visible damage as damage. Hidden damage is never a fact; use CHECK_AFTER_STRIP or INSPECT when appropriate.",
      "In addition to damaged panels, notice estimate-relevant visible attachments around the impact/refinish area: lamps/reflectors, bumper grilles/garnishes, mouldings, liners, retainers if visible, parking sensors, sensor/radar hardware, wiring where visible, badges/emblems, handles, number-plate fittings and decals/company signwriting.",
      "If an intact visible attachment may need removal/refit or transfer to perform the stated repair, it can appear in suggestedOperations as an R&R/TRANSFER/OUTWORK suggestion without falsely labelling it damaged.",
      "When company graphics, decals or signwriting are visible on a panel likely to be refinished, include a separate OUTWORK suggestion noting removal/reinstatement or replacement TBC.",
      "When bumper/sensor/radar equipment is involved, suggest inspection/function-check or calibration consideration only when removal/disturbance is reasonably connected to the repair; do not assert hidden electronic damage.",
      "LH and RH always mean the vehicle's perspective, not the viewer's perspective.",
      "Suggested operations are draft checklist items only. Do not supply prices, labour hours, totals, insurer approval or repair authorization.",
      "Every visible-damage finding and suggested operation must cite at least one supplied photo UUID.",
      "Avoid duplicate operations. Prefer concise workshop-ready descriptions with one physical operation/component per suggestion.",
      "This output requires human estimator review before it becomes part of an issued estimate.",
    ].join("\n"),
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(VehicleIntakeSchema, "vehicle_quick_intake") },
  });

  if (!response.output_parsed) throw new Error("OpenAI did not return a structured quick-intake result");

  const allowedPhotoIds = new Set(input.photos.map((photo) => photo.id));
  const parsed = VehicleIntakeSchema.parse(response.output_parsed);
  const safe = VehicleIntakeSchema.parse({
    ...parsed,
    photoClassifications: parsed.photoClassifications.filter((item) => allowedPhotoIds.has(item.photoId)),
    visibleDamage: parsed.visibleDamage.map((finding) => {
      const evidencePhotoIds = finding.evidencePhotoIds.filter((id) => allowedPhotoIds.has(id));
      return { ...finding, evidencePhotoIds: evidencePhotoIds.length ? evidencePhotoIds : [input.photos[0].id] };
    }),
    suggestedOperations: parsed.suggestedOperations.map((operation) => {
      const evidencePhotoIds = operation.evidencePhotoIds.filter((id) => allowedPhotoIds.has(id));
      return { ...operation, evidencePhotoIds: evidencePhotoIds.length ? evidencePhotoIds : [input.photos[0].id] };
    }),
  });

  return {
    analysis: safe,
    responseId: response.id,
    usage: {
      inputTokens: response.usage?.input_tokens ?? null,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    },
  };
}
