const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const MAX_DIMENSION = 2560;
const TARGET_MAX_BYTES = 2.5 * 1024 * 1024;
const QUALITY_STEPS = [0.84, 0.76, 0.68, 0.6];

function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to compress this image."));
    }, type, quality);
  });
}

function outputName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-") || "vehicle-photo";
  return `${base.slice(0, 100)}.webp`;
}

/**
 * Compresses every user vehicle-photo upload before it reaches private storage.
 * The upload path is UUID-based, so converting to WebP is safe and lets us use a
 * long immutable browser/CDN cache lifetime.
 */
export async function compressImageForUpload(file: File) {
  if (!COMPRESSIBLE_TYPES.has(file.type)) throw new Error(`${file.name} is not a supported image.`);
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined") {
    throw new Error("Image compression is not available in this browser.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${file.name} could not be decoded for compression. Please upload JPG, PNG or WebP, or convert this HEIC/HEIF image first.`);
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Unable to prepare image compression.");
    context.drawImage(bitmap, 0, 0, width, height);

    let blob: Blob | null = null;
    for (const quality of QUALITY_STEPS) {
      blob = await blobFromCanvas(canvas, "image/webp", quality);
      if (blob.size <= TARGET_MAX_BYTES) break;
    }
    if (!blob) throw new Error("Unable to compress this image.");

    return new File([blob], outputName(file.name), {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
