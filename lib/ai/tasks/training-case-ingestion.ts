import { inflateRawSync } from "node:zlib";
import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const TrainingCaseExtractionSchema = z.object({
  title: z.string().min(1),
  sourceReference: z.string().nullable(),
  insurerName: z.string().nullable(),
  vehicleYear: z.number().int().min(1900).max(2100).nullable(),
  vehicleMake: z.string().nullable(),
  vehicleModel: z.string().nullable(),
  vehicleVariant: z.string().nullable(),
  bodyType: z.string().nullable(),
  fuelType: z.string().nullable(),
  colour: z.string().nullable(),
  repairArea: z.string().nullable(),
  damageSummary: z.string().min(1),
  damageTags: z.array(z.string().min(1)).max(30),
  estimatorLessons: z.string().min(1),
  lines: z.array(z.object({
    categoryCode: z.string().min(1),
    side: z.string().nullable(),
    operationCode: z.string().nullable(),
    description: z.string().min(1),
    labourHours: z.number().nonnegative().nullable(),
    approvedAmount: z.number().nonnegative().nullable(),
    blendSelected: z.boolean(),
    reportSelected: z.boolean(),
    notes: z.string().nullable(),
  })).max(200),
});

export type TrainingCaseExtraction = z.infer<typeof TrainingCaseExtractionSchema>;

type ZipImage = {
  name: string;
  bytes: Uint8Array;
  mimeType: string | null;
};

function readUInt16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function imageMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

function isImageName(name: string) {
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

function findEndOfCentralDirectory(bytes: Uint8Array) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let index = bytes.length - 22; index >= minimum; index -= 1) {
    if (readUInt32(bytes, index) === 0x06054b50) return index;
  }
  throw new Error("The photo archive is not a readable ZIP file.");
}

export function extractImagesFromZip(bytes: Uint8Array) {
  if (bytes.byteLength > 120 * 1024 * 1024) throw new Error("Keep the photo ZIP at 120 MB or less.");

  const eocd = findEndOfCentralDirectory(bytes);
  const entryCount = readUInt16(bytes, eocd + 10);
  const centralOffset = readUInt32(bytes, eocd + 16);
  const decoder = new TextDecoder();
  const images: ZipImage[] = [];
  let cursor = centralOffset;
  let totalInflated = 0;

  for (let entryIndex = 0; entryIndex < entryCount; entryIndex += 1) {
    if (readUInt32(bytes, cursor) !== 0x02014b50) throw new Error("The ZIP central directory is invalid.");
    const method = readUInt16(bytes, cursor + 10);
    const compressedSize = readUInt32(bytes, cursor + 20);
    const uncompressedSize = readUInt32(bytes, cursor + 24);
    const nameLength = readUInt16(bytes, cursor + 28);
    const extraLength = readUInt16(bytes, cursor + 30);
    const commentLength = readUInt16(bytes, cursor + 32);
    const localOffset = readUInt32(bytes, cursor + 42);
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!isImageName(name) || name.endsWith("/") || images.length >= 60) continue;
    if (uncompressedSize > 15 * 1024 * 1024) continue;
    if (readUInt32(bytes, localOffset) !== 0x04034b50) continue;

    const localNameLength = readUInt16(bytes, localOffset + 26);
    const localExtraLength = readUInt16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    let inflated: Uint8Array;
    if (method === 0) inflated = compressed;
    else if (method === 8) inflated = new Uint8Array(inflateRawSync(compressed));
    else continue;

    totalInflated += inflated.byteLength;
    if (totalInflated > 90 * 1024 * 1024) throw new Error("The extracted photos are too large. Keep the uncompressed image set below 90 MB.");
    images.push({ name, bytes: inflated, mimeType: imageMime(name) });
  }

  if (!images.length) throw new Error("No JPG, PNG, WebP, HEIC or HEIF photos were found in the ZIP.");
  return images;
}

export async function extractTrainingCaseFromQuoteAndPhotos(input: {
  quoteBytes: Uint8Array;
  quoteFileName: string;
  quoteMimeType: string;
  zipBytes: Uint8Array;
  model: string;
  selectedInsurer?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  if (!input.model) throw new Error("A document/estimate model is not configured.");
  if (input.quoteBytes.byteLength > 25 * 1024 * 1024) throw new Error("Keep the quote document at 25 MB or less.");

  const images = extractImagesFromZip(input.zipBytes);
  const supportedImages = images.filter((image) => image.mimeType).slice(0, 24);
  const client = new OpenAI({ apiKey });
  const uploadedQuote = await client.files.create({
    file: await toFile(input.quoteBytes, input.quoteFileName, { type: input.quoteMimeType || "application/octet-stream" }),
    purpose: "user_data",
  });

  try {
    const imageInputs = supportedImages.map((image) => ({
      type: "input_image" as const,
      image_url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`,
      detail: "high" as const,
    }));

    const response = await client.responses.parse({
      model: input.model,
      instructions: [
        "You are extracting one human-approved automotive repair estimating training case.",
        "The uploaded quote/estimate is authoritative for the approved operation line structure, historical labour hours and historical approved amounts.",
        "The damage photos are authoritative only for visible vehicle/damage context. Do not invent hidden damage from the photos.",
        "Do not add estimate operations that are absent from the quote merely because they seem common.",
        "Create one structured line for each distinct operation shown in the quote. Keep R&R, repair, cut/weld, paint, blend, parts, diagnostics, ADAS, outwork and materials separate when the quote separates them.",
        "Normalize categoryCode into concise estimator categories such as rr, square_align, cut_weld, repair, paint, parts, mechanical, electrical, diagnostics, adas, srs, outwork, panel_materials, paint_materials or miscellaneous.",
        "Historical prices and hours may be extracted for audit, but estimatorLessons must be price-neutral and must never tell future jobs to copy historical prices or hours blindly.",
        "Estimator lessons should explain completeness patterns supported by this case and identify items that should remain TBC/check-after-strip on a future job unless current evidence supports them.",
        input.selectedInsurer ? `The administrator selected insurer/job type: ${input.selectedInsurer}. Preserve it unless the quote clearly identifies a more specific insurer name.` : "If the quote clearly identifies an insurer, extract its name; otherwise return null.",
        "Do not include customer names, addresses, phone numbers, emails, bank details or other unnecessary personal information in the training output.",
      ].join("\n"),
      input: [{
        role: "user",
        content: [
          { type: "input_file", file_id: uploadedQuote.id },
          ...imageInputs,
          { type: "input_text", text: `Build a draft Training Case from this final quote and its matching damage-photo archive. ${images.length} image files were found; ${supportedImages.length} supported images are attached for visual context. Return only facts supported by the supplied quote/photos.` },
        ],
      }],
      text: { format: zodTextFormat(TrainingCaseExtractionSchema, "estimator_training_case_extraction") },
    });

    if (!response.output_parsed) throw new Error("The AI did not return a structured Training Case.");
    const extracted = TrainingCaseExtractionSchema.parse(response.output_parsed);
    const manifest = images.map((image, index) => ({
      name: image.name,
      bytes: image.bytes.byteLength,
      sent_to_model: index < supportedImages.length && Boolean(image.mimeType),
      supported_for_vision: Boolean(image.mimeType),
    }));

    return {
      extracted,
      photoCount: images.length,
      photoManifest: manifest,
      responseId: response.id,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    };
  } finally {
    await client.files.delete(uploadedQuote.id).catch(() => undefined);
  }
}
