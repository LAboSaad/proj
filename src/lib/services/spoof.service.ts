// src/lib/services/spoof.service.ts
//
// Lightweight client-side spoof detection based on pixel variance.
// Low variance → likely a flat screen or printed photo → flag as spoof.
//
// This is a first-pass heuristic only. It is not a substitute for
// server-side liveness analysis.

import { dataUrlToImage, getCanvasFromImage } from "../../utils/image";
import { mean, variance } from "../utils";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Images with pixel variance below this threshold are considered spoofs.
 * A real face in varied lighting typically produces variance well above 300.
 * Screens and prints tend to be flatter, producing variance below this value.
 */
const SPOOF_VARIANCE_THRESHOLD = 300;

// ── Spoof detection ───────────────────────────────────────────────────────────

/**
 * Returns true if the image is likely a spoof (screen / printed photo).
 *
 * Previously used the async-in-Promise-constructor anti-pattern — if the
 * inner async threw, the promise would never reject and the caller would hang.
 * Rewritten as a plain async function to guarantee rejection propagates.
 *
 * Also removes the local mean/variance reimplementations — these already
 * exist in src/lib/utils and are imported directly.
 */
export async function detectPossibleSpoof(
  imageDataUrl: string,
): Promise<boolean> {
  const img = await dataUrlToImage(imageDataUrl);
  const canvas = getCanvasFromImage(img);
  const ctx = canvas.getContext("2d");

  if (!ctx) return false;

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Convert pixels to grayscale values
  const grayValues: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    grayValues.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  }

  const pixelVariance = variance(grayValues);

  return pixelVariance < SPOOF_VARIANCE_THRESHOLD;
}
