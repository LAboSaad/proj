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


export const normalizeMRZ = (lines: string[]) =>
  lines.map((l) => {
    let line = l.replace(/[^A-Z0-9<]/g, "");

    if (line.length < 44) line = line.padEnd(44, "<");
    if (line.length > 44) line = line.slice(0, 44);

    return line;
  });

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

export function repairMRZLine(line: string, index: number): string {
  let l = line.toUpperCase();

  // 🔥 Common OCR fixes
  l = l
    .replace(/O/g, "0")       // O → 0
    .replace(/Q/g, "0")       // Q → 0
    .replace(/I/g, "1")       // I → 1
    .replace(/L/g, "1")       // L → 1 (only numeric zones benefit)
    .replace(/Z/g, "2")       // Z → 2
    .replace(/S/g, "5")       // S → 5
    .replace(/B/g, "8");      // B → 8

  // 🔥 Fix illegal characters
  l = l.replace(/[^A-Z0-9<]/g, "<");

  // 🔥 CRITICAL FIXES BY LINE TYPE
  if (index === 0) {
    // Passport line MUST start with P<
    if (!l.startsWith("P<")) {
      l = "P<" + l.slice(2);
    }
  }

  if (index === 1) {
    // Line 2 must NOT start with 0P or OP
    l = l.replace(/^0P/, "P<");
    l = l.replace(/^OP/, "P<");

    // Document number should be alphanumeric (fix common issues)
    l = l.replace(/</g, "<"); // keep fillers
  }

  return l;
}