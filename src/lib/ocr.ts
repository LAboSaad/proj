// src/lib/ocr.ts
//
// MRZ extraction pipeline for DRC identity documents.
//
// Supported document types:
//   • Passport       — 2-line MRZ (TD3), bottom ~22% of page
//   • National ID    — 2-line MRZ (TD1/TD2), bottom ~18% of page
//   • Driver licence — no standardised MRZ; OCR falls back to full-page
//
// Pipeline per image:
//   1. Detect document type from aspect ratio
//   2. Crop the MRZ region
//   3. Upscale + contrast boost
//   4. Adaptive threshold using summed-area table (O(n) not O(n×w²))
//   5. Polarity correction (invert if text is white-on-black)
//   6. Normalise OCR output
//   7. Extract and validate MRZ lines

// ── Document type detection ───────────────────────────────────────────────────

type DocumentType = "passport" | "national-id" | "licence" | "unknown";

/**
 * Infers document type from the image aspect ratio.
 * Passports (TD3): ~1.42 wide  (ISO 7810 ID-3: 125×88mm)
 * National IDs:    ~1.59 wide  (ISO 7810 ID-1: 85.6×54mm)
 * Driver licences: ~1.59 wide  (same card stock as ID-1)
 *
 * We can't distinguish ID-1 from licence by ratio alone, so both map to
 * "national-id" for cropping purposes and "licence" is only used as a
 * fallback when no MRZ lines are found after parsing.
 */
export function detectDocumentType(image: HTMLImageElement): DocumentType {
  const ratio = image.naturalWidth / Math.max(1, image.naturalHeight);
  if (ratio >= 1.35 && ratio <= 1.50) return "passport";
  if (ratio >= 1.50 && ratio <= 1.75) return "national-id";
  return "unknown";
}

// ── MRZ crop ──────────────────────────────────────────────────────────────────

/**
 * Crops the region most likely to contain the MRZ based on document type.
 *
 * Passport  (TD3): bottom 22% — two 44-char lines
 * National ID (TD1): bottom 28% — two or three lines, positioned lower
 * Unknown/licence: bottom 30% — widest crop as fallback
 */
export function cropMRZRegion(
  image: HTMLImageElement,
  docType: DocumentType = "unknown",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx    = canvas.getContext("2d")!;

  const w = image.naturalWidth;
  const h = image.naturalHeight;

  const cropFraction =
    docType === "passport"    ? 0.22
    : docType === "national-id" ? 0.28
    :                             0.30;

  const cropH = Math.floor(h * cropFraction);

  canvas.width  = w;
  canvas.height = cropH;

  ctx.drawImage(image, 0, h - cropH, w, cropH, 0, 0, w, cropH);

  return canvas;
}

// ── Summed-area table (integral image) ───────────────────────────────────────
//
// Naïve adaptive threshold is O(n × windowSize²) ≈ 3.8 billion ops on a
// 4K canvas. The integral image reduces per-pixel cost to O(1), making the
// entire pass O(n) regardless of window size.

function buildIntegralImage(gray: Float32Array, w: number, h: number): Float64Array {
  const integral = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      integral[i] =
        gray[i]
        + (x > 0 ? integral[i - 1]     : 0)
        + (y > 0 ? integral[i - w]     : 0)
        - (x > 0 && y > 0 ? integral[i - w - 1] : 0);
    }
  }
  return integral;
}

function getAreaSum(
  integral: Float64Array,
  w: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  let sum = integral[y2 * w + x2];
  if (x1 > 0)             sum -= integral[y2  * w + (x1 - 1)];
  if (y1 > 0)             sum -= integral[(y1 - 1) * w + x2];
  if (x1 > 0 && y1 > 0)  sum += integral[(y1 - 1) * w + (x1 - 1)];
  return sum;
}

/**
 * Adaptive threshold using summed-area table.
 * Each pixel is compared against the mean of its local neighbourhood.
 * C=10 is the constant subtracted from the mean — pixels brighter than
 * (mean - C) become white (255), others become black (0).
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  windowSize = 15,
  C = 10,
): Uint8ClampedArray {
  const half = Math.floor(windowSize / 2);

  // Build grayscale plane
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i] + data[i + 1] + data[i + 2]) / 3;
  }

  const integral = buildIntegralImage(gray, w, h);
  const out      = new Uint8ClampedArray(data.length);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(w - 1, x + half);
      const y2 = Math.min(h - 1, y + half);

      const count    = (x2 - x1 + 1) * (y2 - y1 + 1);
      const areaSum  = getAreaSum(integral, w, x1, y1, x2, y2);
      const mean     = areaSum / count;

      const value = gray[y * w + x] > mean - C ? 255 : 0;

      const i = (y * w + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = value;
      out[i + 3] = 255;
    }
  }

  return out;
}

// ── Polarity correction ───────────────────────────────────────────────────────

/**
 * MRZ text is always dark-on-light (black text on white background).
 * If the thresholded image has more black than white, the image is inverted
 * (white-on-black scan). We invert it so Tesseract always sees dark-on-light.
 *
 * Previously this counted pixels but never applied the inversion — fixed here.
 */
function correctPolarity(data: Uint8ClampedArray): Uint8ClampedArray {
  let white = 0;
  let black = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 255) white++;
    else                  black++;
  }

  if (white >= black) return data; // already dark-on-light

  // Invert: swap black ↔ white, keep alpha
  const inverted = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    inverted[i]     = data[i]     === 255 ? 0 : 255;
    inverted[i + 1] = data[i + 1] === 255 ? 0 : 255;
    inverted[i + 2] = data[i + 2] === 255 ? 0 : 255;
    inverted[i + 3] = 255;
  }

  return inverted;
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * Full preprocessing pipeline:
 *   1. 2× upscale with contrast + brightness boost
 *   2. Adaptive threshold (integral image — O(n))
 *   3. Polarity correction
 *
 * Returns a binary (black/white) canvas ready for Tesseract.
 */
export async function preprocessMRZCanvas(
  canvas: HTMLCanvasElement,
): Promise<HTMLCanvasElement> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context unavailable.");

  // Step 1: upscale with contrast boost
  const upscaled   = document.createElement("canvas");
  upscaled.width   = canvas.width  * 2;
  upscaled.height  = canvas.height * 2;
  const uctx       = upscaled.getContext("2d")!;
  uctx.filter      = "contrast(180%) brightness(110%)";
  uctx.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);

  // Step 2: adaptive threshold
  const imageData   = uctx.getImageData(0, 0, upscaled.width, upscaled.height);
  const thresholded = adaptiveThreshold(imageData.data, upscaled.width, upscaled.height);

  // Step 3: polarity correction
  const corrected   = correctPolarity(thresholded);

  imageData.data.set(corrected);
  uctx.putImageData(imageData, 0, 0);

  return upscaled;
}

// ── Text normalisation ────────────────────────────────────────────────────────

/**
 * Cleans raw Tesseract output into a string safe for MRZ parsing.
 *
 * Critical fixes vs previous version:
 *   • Removed blanket L→< and K→< replacements — those destroyed legitimate
 *     name characters. L and K appear in real MRZ names (e.g. LAYLA, BAKR).
 *   • Only replace characters that are NEVER valid in any MRZ position:
 *     common OCR confusions in the filler/check-digit area are handled by
 *     the per-line fixup in useOCR instead.
 */
export function normalizeMRZText(text: string): string {
  return text
    .toUpperCase()
    // Collapse all whitespace within a line (MRZ has no spaces)
    .replace(/[^\S\n]/g, "")
    // OCR commonly reads the filler '<' as '(' or ')' — safe global replace
    .replace(/[()]/g, "<")
    // Remove any character that is not valid in MRZ at all
    .replace(/[^A-Z0-9<\n]/g, "")
    .trim();
}

// ── Line extraction ───────────────────────────────────────────────────────────

/**
 * Extracts MRZ candidate lines from normalised OCR output.
 *
 * TD3 (passport):    2 lines × 44 chars
 * TD1 (national ID): 3 lines × 30 chars  ← DRC IDs may be TD1
 * TD2:               2 lines × 36 chars
 *
 * Strategy:
 *   1. Split on newlines
 *   2. Keep lines ≥ 30 chars made up of MRZ characters only
 *   3. Try to identify TD3 (44-char) or TD1 (30-char) based on lengths
 *   4. Return the best matching set — TD3 pair if available, else TD1 triple
 */
export function extractMRZLines(text: string): string[] {
  const candidates = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 30 && /^[A-Z0-9<]+$/.test(l));

  if (candidates.length === 0) return [];

  // Prefer TD3 (passport): two lines of exactly 44 chars
  const td3 = candidates.filter((l) => l.length === 44 || (l.length >= 42 && l.length <= 46));
  if (td3.length >= 2) return td3.slice(-2);

  // Fallback to TD1 (DRC national ID): three lines of ~30 chars
  const td1 = candidates.filter((l) => l.length >= 28 && l.length <= 32);
  if (td1.length >= 2) return td1.slice(-Math.min(3, td1.length));

  // Last resort: return last two candidates regardless of length
  return candidates.slice(-2);
}