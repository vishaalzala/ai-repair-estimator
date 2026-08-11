import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

export const DamageAnalysisSchema = z.object({
  impactArea: z.string().min(1),
  severity: z.enum(["minor", "moderate", "major", "unknown"]),
  summary: z.string().min(1),
  findings: z.array(z.object({
    component: z.string().min(1),
    side: z.enum(["LH", "RH", "FRONT", "REAR", "CENTRE", "NA"]).nullable(),
    observedDamage: z.string().min(1),
    suggestedAction: z.enum(["REPAIR", "REPLACE", "R&R", "TRANSFER", "PAINT", "BLEND", "CUT&WELD", "ALIGN", "CHECK_AFTER_STRIP", "OUTWORK", "TBC", "INSPECT"]),
    confidence: z.number().min(0).max(1),
    evidencePhotoIds: z.array(z.string()).min(1),
    inspectionNote: z.string().nullable(),
  })).max(80),
  inspectionSuggestions: z.array(z.string()).max(30),
});

export type DamageAnalysis = z.infer<typeof DamageAnalysisSchema>;

export type DamagePhotoInput = {
  id: string;
  signedUrl: string;
  category: string;
  fileName: string;
};

export type DamageVehicleContext = {
  registration?: string | null;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  modelYear?: number | null;
  bodyType?: string | null;
  fuelType?: string | null;
  isEv?: boolean | null;
  isHybrid?: boolean | null;
  adasPresent?: boolean | null;
  accidentDescription?: string | null;
};

export async function analyzeVehicleDamage(input: {
  model: string;
  vehicle: DamageVehicleContext;
  photos: DamagePhotoInput[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  if (!input.model) throw new Error("AI_DAMAGE_MODEL is not configured");
  if (!input.photos.length) throw new Error("At least one evidence photo is required");

  const client = new OpenAI({ apiKey });
  const vehicleText = [
    `Registration: ${input.vehicle.registration ?? "unknown"}`,
    `VIN: ${input.vehicle.vin ?? "unknown"}`,
    `Vehicle: ${[input.vehicle.modelYear, input.vehicle.make, input.vehicle.model, input.vehicle.variant].filter(Boolean).join(" ") || "unknown"}`,
    `Body type: ${input.vehicle.bodyType ?? "unknown"}`,
    `Fuel: ${input.vehicle.fuelType ?? "unknown"}`,
    `EV: ${input.vehicle.isEv ? "yes" : "no/unknown"}`,
    `Hybrid: ${input.vehicle.isHybrid ? "yes" : "no/unknown"}`,
    `ADAS present: ${input.vehicle.adasPresent === true ? "yes" : input.vehicle.adasPresent === false ? "no" : "not confirmed"}`,
    `Reported accident: ${input.vehicle.accidentDescription ?? "not provided"}`,
  ].join("\n");

  const photoLegend = input.photos.map((photo, index) => `Photo ${index + 1}: id=${photo.id}; category=${photo.category}; file=${photo.fileName}`).join("\n");
  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "high" }
  > = [
    {
      type: "input_text",
      text: `${vehicleText}\n\nPHOTO LEGEND\n${photoLegend}\n\nAnalyse only visible evidence in the supplied vehicle photos.`,
    },
    ...input.photos.map((photo) => ({ type: "input_image" as const, image_url: photo.signedUrl, detail: "high" as const })),
  ];

  const response = await client.responses.parse({
    model: input.model,
    instructions: [
      "You are assisting a professional automotive repair estimator with preliminary visible-damage review.",
      "Describe only damage that is visibly supported by the supplied photos and provided vehicle context.",
      "Never invent hidden damage, parts prices, labour times, repair totals or insurer requirements.",
      "When hidden damage is plausible but not visible, use CHECK_AFTER_STRIP or INSPECT and state that it is not confirmed.",
      "LH and RH always mean the vehicle's perspective, not the viewer's perspective.",
      "Use the exact supplied photo UUIDs in evidencePhotoIds. Every finding must cite at least one supporting photo.",
      "If image evidence is insufficient, lower confidence and recommend inspection rather than asserting damage.",
      "This output is a draft for human estimator review and must not be treated as repair authorization.",
    ].join("\n"),
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(DamageAnalysisSchema, "vehicle_damage_analysis") },
  });

  if (!response.output_parsed) throw new Error("OpenAI did not return a structured damage analysis");

  const allowedPhotoIds = new Set(input.photos.map((photo) => photo.id));
  const parsed = DamageAnalysisSchema.parse(response.output_parsed);
  const safe: DamageAnalysis = {
    ...parsed,
    findings: parsed.findings.map((finding) => {
      const evidencePhotoIds = finding.evidencePhotoIds.filter((id) => allowedPhotoIds.has(id));
      return {
        ...finding,
        evidencePhotoIds: evidencePhotoIds.length ? evidencePhotoIds : [input.photos[0].id],
        suggestedAction: finding.suggestedAction,
      };
    }),
  };

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
