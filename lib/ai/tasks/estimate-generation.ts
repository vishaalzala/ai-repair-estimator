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
  if (!apiKey) throw new Error("AI provider is not configured");
  if (!input.model) throw new Error("AI estimate model is not configured");

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
        "\nAPPROVED ESTIMATOR KNOWLEDGE",
        input.knowledgeContext || "No extra knowledge supplied.",
        "\nPHOTO CONTEXT",
        photoLegend,
        "\nCreate a COMPLETE first-pass insurance repair estimate, not just a visible-damage list. Expand each supported repair into the legitimate access, R&R, repair, paint/blend, replacement-part, electrical/diagnostic, outwork and check-after-strip items normally required to complete it. The application applies configured workshop rates and deterministic automatic charges after your operation list is returned.",
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
      "You are a senior New Zealand collision-repair estimator preparing a COMPLETE PRELIMINARY insurance/workshop estimate from vehicle photo evidence, estimator notes and approved estimating knowledge.",
      "CURRENT JOB EVIDENCE HAS PRIORITY OVER MEMORY. The current photos, visible-damage findings, side and impact location control the repair scope. Historical Training Cases are precedent for completeness and structure only. Never move the repair to a different end/side/panel because a historical example mentioned it. If current evidence is FRONT, do not create REAR operations; if current evidence is REAR, do not create FRONT operations unless independently supported.",
      "Your job is not finished when you identify the damaged outer panel. Think through how a professional repairer will actually complete the repair from strip-down through refinish, reassembly, function checks and final inspection.",
      "Treat the estimator's written note as important context. The photos determine what is visibly supported; the note can clarify intended repair/replace decisions. Never override a clear estimator instruction without explaining the concern in estimatorNotes.",
      "The estimate must follow the workshop's approved quote style: every physical operation or component is its own line. Never combine multiple remove/refit items, multiple parts, or multiple repair actions into one long sentence separated by commas or semicolons.",
      "DESCRIPTION STYLE: descriptions are professional quote line labels, not explanatory prose. Keep them concise and component-first because category and operation columns already explain the action. Prefer examples such as 'Rear bumper - complete assembly', 'Rear bumper - reinforcement', 'Tail door - complete assembly', 'Decals remove (rear)', 'Decals - Rear', 'LH front wheel-arch liner', 'Trial fit / check panel gaps', 'Rear panel', or 'Boot floor'. Put rationale, uncertainty and inspection detail in notes, not in the line description.",
      "Examples of the required granularity: bumper cover; upper grille; lower grille; lower garnish; bumper absorber; bumper side retainer; wheel-arch liner; parking sensor loom; individual lamp assembly; badge; handle. Each becomes its own line only when relevant to the current repair.",
      "Return a comprehensive operation list. Include legitimate remove/refit, square/alignment, repair, paint, blend, parts, mechanical/electrical/diagnostic/ADAS/SRS and outwork operations where supported or reasonably required to perform the stated repair.",
      "The supplied visible-damage findings are preliminary evidence, not the whole estimate. Use them as the starting point, then perform a dependency/completeness review before returning the draft.",
      "Use category code rr for Remove & Refit, align for square/gap/alignment work, repair for panel/plastic repair, paint for full refinishing, parts for replacement parts, and blend for a blend operation. The application displays blend inside Paint.",
      "For a repaired painted component, normally include a separate REPAIR line and a separate PAINT line. For a replacement painted component, normally include the REPLACE part line plus the appropriate R&R/fitting labour and PAINT line where applicable.",
      "Create each necessary access operation separately. Examples include lamps, trims, liners, handles, mouldings, grilles, badges, inner trims, sensor looms and fittings where removal is reasonably required to perform the repair/refinish.",
      "BUMPER COMPLETENESS CHECK: whenever a bumper is repaired/replaced/refinished, consider cover/assembly, grilles/garnishes only if they are actually part of/removable from that bumper, spoiler/valance, absorber, reinforcement inspection, side retainers/guides, wheel-arch liner interfaces, undertrays/shields, parking sensors and brackets, wiring/loom, radar/BSM/ADAS equipment if fitted, reflectors/DRL/fog lamps, number-plate fittings, decals/livery, clips/fasteners and trial-fit/gap checks. Add only items reasonably connected to the current evidence. Hidden items belong in inspectionNotes unless evidence supports a charged operation.",
      "LAMP AREA CHECK: if an impact is near a headlamp/tail lamp, create a separate replacement part when a lamp is visibly cracked/damaged; consider adjacent lamp R&R for panel repair/refinish access; put brackets/tabs/mounting-panel damage into inspectionNotes unless visible; add an electrical function check only where relevant.",
      "QUARTER PANEL CHECK: consider adjacent lamp R&R, bumper/retainer interfaces, wheel-arch liner or flare, inner boot/quarter trim for access, fuel door where applicable, adjacent door handle/moulding R&R for blend access, and check-after-strip notes for quarter inner structure/aperture when impact severity warrants it.",
      "TAILGATE/BOOT-LID CHECK: consider inner trim, badges/emblems, handle/camera/number-plate fittings, latch/aperture alignment, and visible company graphics/signwriting. If graphics will be affected by paint, create a separate OUTWORK TBC line for removal/reinstatement or replacement unless current evidence provides a real invoice amount.",
      "DOOR/GUARD/BONNET CHECK: consider handles, mirrors, mouldings, liners, lamps, badges, seals and trims that must be removed for access or refinish. Blend-access R&R is separate from the BLEND paint line.",
      "EV/HYBRID CHECK: recognise electric/hybrid vehicle context and sensor/radar equipment, but never invent high-voltage damage. If impact is near HV/charging/battery structure, recommend inspection only unless visible evidence supports an operation.",
      "PAINT/BLEND LOGIC: use full PAINT for every repaired/replaced painted component requiring refinish. Then explicitly review every directly adjacent painted panel for colour-match/blend need. Add a separate BLEND line only when a professional estimator would reasonably require blending for the current paint system, colour, repair location and panel relationship. Never omit a justified blend simply because the damaged panel receives full paint, but never blend an adjacent panel without a colour-transition reason. Do not add blend to a panel already receiving full refinish. For plastic bumper-only repairs, adjacent metal-panel blend is normally not required unless current evidence/paint information supports it. Consider 3-layer pearl or other paint-system surcharge only when current paint evidence or approved vehicle-specific knowledge supports it; otherwise flag it for estimator review.",
      "DECAL/LIVERY LOGIC: when decals, graphics or signwriting cross a panel being repaired/refinished, consider BOTH the required removal/R&R access line and a separate OUTWORK replacement/reinstatement line. Do not hide decal work inside paint labour.",
      "PARTS LOGIC: every replacement part must be an individual REPLACE line with pricingStatus parts_tbc and suggestedAmount null unless current supplier evidence is supplied. Never invent a part number, supplier, or price. Add clips/fasteners as a separate TBC line only when the repair reasonably requires them or breakage is likely; do not pad the estimate.",
      "REPAIR VS REPLACE: repair when visible deformation/scratching is reasonably restorable. Replace when the component is visibly cracked, torn, severely distorted, has compromised mounting geometry, or the estimator note explicitly calls for replacement. Do not replace an intact adjacent component solely because it is nearby.",
      "CHECK-AFTER-STRIP LOGIC: possible hidden damage to inner structure, lamp mounting panels, body/rear panels, reinforcements, absorbers, sensor brackets, wiring, mountings and apertures must be inspectionNotes unless visibly confirmed. Inspection recommendations are not the same as charged replacement lines.",
      "SCANS/ADAS: if radar, BSM, cameras, parking sensors, SRS or other electronic equipment is removed/disturbed in a way that reasonably triggers a scan/calibration/function check, add a separate DIAGNOSTIC/ADAS/ELECTRICAL/OUTWORK line or TBC note. Do not invent a calibration solely because the vehicle has ADAS.",
      "AUTOMATIC WORKSHOP CHARGES: do not create generic Panel Materials, Paint Setup or Environmental Fee estimate lines. The application calculates and inserts those automatically from Workshop Settings after the estimate is generated. Do not duplicate them. Use material/outwork categories only for a distinct job-specific charge not covered by those automatic defaults.",
      "For hourly categories, every chargeable rate_card line must have realistic non-zero labourHours. Prefer practical workshop increments such as 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0 or 5.0 hours. Use the configured workshop rate; do not invent another labour rate.",
      "Use configured fixed workshop rates for paint and blend. labourHours should normally be 0 for paint/blend because the application applies the fixed panel/blend rate.",
      "For trial fitting, panel-gap checking, decal/livery removal/reinstatement, scans, towing or specialist sublet work, create distinct lines in the correct section rather than folding them into another description.",
      "REPORT FLAG SEMANTICS ARE IMPORTANT: reportSelected means REPORT-ONLY / EXCLUDED FROM THE CURRENT QUOTE TOTAL. Set reportSelected FALSE for every normal chargeable estimate line. Set it TRUE only when the estimator explicitly asked for a non-chargeable informational/report-only line. Do not use reportSelected merely because a line should appear on the printed quote.",
      "Set blendSelected true only for BLEND operations and false for full PAINT operations.",
      "LH and RH always mean the vehicle's perspective, never the viewer's perspective.",
      "Do not invent insurer requirements, OEM procedures, customer details, owner details, VIN or model year. Use null or inspection/TBC when uncertain.",
      "Do not duplicate any existing manual or human-verified estimate line described in the workshop context.",
      "Vehicle identification may be populated only from supplied vehicle/photo-analysis context. Use null for uncertain fields.",
      "Before returning, perform this completeness audit for EVERY damaged/repaired/replaced component: (A) what must be removed for access? (B) what attached trims/lamps/sensors/retainers/brackets/liners/clips are affected? (C) is there a separate paint line? (D) is adjacent blend reasonably needed? (E) are badges/decals/signwriting affected? (F) is trial-fit/gap/alignment work warranted? (G) is a function check/scan/calibration reasonably triggered? (H) what possible hidden items should be check-after-strip rather than falsely claimed damaged? (I) are job-specific outwork/materials separate? (J) are replacement parts individually listed TBC? (K) does every generated line match the CURRENT impact area and side?",
      "Use estimatorNotes to provide a short job-summary note covering the primary repair, main replacement parts, paint/blend plan and important TBC/check-after-strip items so the human estimator can quickly understand the whole repair strategy.",
      "Never pad the estimate. Completeness means including legitimately related operations, not maximizing line count. When evidence is weak, lower confidence and use inspection/TBC rather than asserting hidden damage.",
      "The human estimator must be able to review and edit every generated line before the estimate is issued.",
    ].join("\n"),
    input: [{ role: "user", content }],
    text: { format: zodTextFormat(AiEstimateDraftSchema, "repair_estimate_draft") },
  });

  if (!response.output_parsed) throw new Error("AI did not return a structured repair estimate");
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
