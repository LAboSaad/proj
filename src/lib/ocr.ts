import { rgbToGray } from "../utils/image";


/**
 * ================================
 * Crop MRZ (bottom 30%)
 * ================================
 */
export function cropMRZRegion(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  const width = image.naturalWidth;
  const height = image.naturalHeight;

  // 🔥 tighter crop improves OCR a LOT
  const mrzHeight = Math.floor(height * 0.22);

  canvas.width = width;
  canvas.height = mrzHeight;

  ctx.drawImage(
    image,
    0,
    height - mrzHeight,
    width,
    mrzHeight,
    0,
    0,
    width,
    mrzHeight
  );

  return canvas;
}

/**
 * ================================
 * Strong MRZ preprocessing
 * ================================
 */
export async function preprocessMRZCanvas(
  canvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas error");

  const { width, height } = canvas;

  // 🔥 UPSCALE first (huge improvement)
  const upscale = document.createElement("canvas");
  upscale.width = width * 2;
  upscale.height = height * 2;

  const uctx = upscale.getContext("2d")!;
  uctx.drawImage(canvas, 0, 0, upscale.width, upscale.height);

  const imageData = uctx.getImageData(0, 0, upscale.width, upscale.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = rgbToGray(data[i], data[i + 1], data[i + 2]);

    // 🔥 adaptive threshold
    const value = gray > 135 ? 255 : 0;

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  uctx.putImageData(imageData, 0, 0);

  return upscale;
}

/**
 * ================================
 * Normalize OCR text (CRITICAL)
 * ================================
 */
export function normalizeMRZText(text: string): string {
  return text
    .toUpperCase()
    .replace(/ /g, "")  
    .replace(/L/g, "<")        // critical
    .replace(/K/g, "<")        // 🔥 add this (you had K noise)
    .replace(/</g, "<")
    .replace(/^0P/, "P<")      // 🔥 FIXED (no shifting)
    .replace(/[^A-Z0-9<\n]/g, "")
    .trim();
}


/**
 * ================================
 * Extract MRZ lines properly
 * ================================
 */
export function extractMRZLines(text: string): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 35 && /^[A-Z0-9<]+$/.test(l));

  // 🔥 always take LAST 2 (MRZ position)
  return lines.slice(-2);
}
