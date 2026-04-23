import type { DocumentQuality } from "../types/kyc";
import { dataUrlToImage, getCanvasFromImage, rgbToGray } from "../utils/image";
import { mean, variance } from "./utils";

/**
 * ================================
 * Tunable thresholds (REALISTIC)
 * ================================
 */
const OCR_MIN_WIDTH = 900;
const OCR_MIN_HEIGHT = 550;

const MIN_BRIGHTNESS = 60;
const MIN_CONTRAST = 35;

const GLARE_THRESHOLD = 0.06;

// 🔥 Updated blur thresholds (soft logic)
const BLUR_GOOD = 60;
const BLUR_BAD = 40;

// Edge density (text/detail presence)
const MIN_EDGE_DENSITY = 0.012;

/**
 * ================================
 * Main analyzer
 * ================================
 */
export async function analyzeDocumentQuality(dataUrl: string): Promise<DocumentQuality> {
  const image = await dataUrlToImage(dataUrl);
  const canvas = getCanvasFromImage(image);
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas context not available.");

  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  const totalPixels = width * height;

  const grays: number[] = new Array(totalPixels);
  let glarePixels = 0;

  /**
   * ================================
   * Grayscale + glare detection
   * ================================
   */
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const gray = rgbToGray(data[i], data[i + 1], data[i + 2]);
    grays[p] = gray;

    if (gray >= 245) glarePixels++;
  }

  /**
   * ================================
   * Laplacian (blur detection)
   * ================================
   */
  const laplacianValues: number[] = [];
  let strongEdgeCount = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      const lap =
        4 * grays[idx] -
        grays[idx - width] -     // top
        grays[idx + width] -     // bottom
        grays[idx - 1] -         // left
        grays[idx + 1];          // right

      laplacianValues.push(lap);

      if (Math.abs(lap) > 25) strongEdgeCount++;
    }
  }

  /**
   * ================================
   * Metrics
   * ================================
   */
  const brightness = Number(mean(grays).toFixed(2));
  const contrast = Number(Math.sqrt(variance(grays)).toFixed(2));
  const blurScore = Number(variance(laplacianValues).toFixed(2));

  const edgeDensity = Number(
    (strongEdgeCount / Math.max(1, (width - 2) * (height - 2))).toFixed(4)
  );

  const glareRatio = Number((glarePixels / totalPixels).toFixed(4));
  const aspectRatio = Number((width / Math.max(1, height)).toFixed(4));

  /**
   * ================================
   * Smart evaluations
   * ================================
   */

  // 🔥 Blur classification (NOT binary anymore)
  let blurStatus: "good" | "ok" | "bad";

  if (blurScore >= BLUR_GOOD) blurStatus = "good";
  else if (blurScore >= BLUR_BAD) blurStatus = "ok";
  else blurStatus = "bad";

  const looksSharpEnough = blurStatus !== "bad";

  const looksBrightEnough =
    brightness >= MIN_BRIGHTNESS && contrast >= MIN_CONTRAST;

  const looksLowGlare = glareRatio <= GLARE_THRESHOLD;

  const hasEnoughDetail = edgeDensity >= MIN_EDGE_DENSITY;

  /**
   * ================================
   * Final OCR usability decision
   * ================================
   */
  const looksUsefulForOCR =
    width >= OCR_MIN_WIDTH &&
    height >= OCR_MIN_HEIGHT &&
    looksSharpEnough &&
    looksBrightEnough &&
    looksLowGlare &&
    hasEnoughDetail;

  /**
   * ================================
   * Reasons (user feedback)
   * ================================
   */
  const reasons: string[] = [];

  if (width < OCR_MIN_WIDTH || height < OCR_MIN_HEIGHT) {
    reasons.push("Image resolution is low for OCR.");
  }

  if (blurStatus === "bad") {
    reasons.push("Image is too blurry.");
  } else if (blurStatus === "ok") {
    reasons.push("Image is slightly blurry.");
  }

  if (!looksBrightEnough) {
    reasons.push("Lighting or contrast looks weak.");
  }

  if (!looksLowGlare) {
    reasons.push("Glare is too high.");
  }

  if (!hasEnoughDetail) {
    reasons.push("Document details look faint or low-definition.");
  }

  /**
   * ================================
   * Return result
   * ================================
   */
  return {
    width,
    height,
    brightness,
    contrast,
    blurScore,
    edgeDensity,
    aspectRatio,
    glareRatio,
    looksSharpEnough,
    looksBrightEnough,
    looksLowGlare,
    looksUsefulForOCR,
    reasons,
  };
}