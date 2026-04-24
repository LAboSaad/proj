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



function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const windowSize = 15;
  const half = Math.floor(windowSize / 2);

  // 🔥 Precompute grayscale once
  const gray = new Float32Array(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  const out = new Uint8ClampedArray(data.length);

  const getGray = (x: number, y: number) => gray[y * width + x];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += getGray(nx, ny);
            count++;
          }
        }
      }

      const mean = sum / count;
      const g = getGray(x, y);

      const value = g > mean - 10 ? 255 : 0;

      const i = (y * width + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = value;
      out[i + 3] = 255;
    }
  }

  return out;
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

  // ── Step 1: upscale ───────────────────────────────
  const upscale = document.createElement("canvas");
  upscale.width = width * 2;
  upscale.height = height * 2;

  const uctx = upscale.getContext("2d")!;

  // 🔥 Contrast boost BEFORE processing (important)
  uctx.filter = "contrast(180%) brightness(110%)";
  uctx.drawImage(canvas, 0, 0, upscale.width, upscale.height);

  // ── Step 2: get pixels ────────────────────────────
  const imageData = uctx.getImageData(0, 0, upscale.width, upscale.height);
  const data = imageData.data;

  const w = upscale.width;
  const h = upscale.height;

  // ── Step 3: adaptive threshold ────────────────────
  const thresholded = adaptiveThreshold(data, w, h);

 // ── Step 4: enforce MRZ polarity (white text on black) ───
let whitePixels = 0;
let blackPixels = 0;

// Count pixels
for (let i = 0; i < thresholded.length; i += 4) {
  if (thresholded[i] === 255) whitePixels++;
  else blackPixels++;
}


  // ── Step 5: write back ────────────────────────────
  imageData.data.set(thresholded);
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
