import * as faceapi from "face-api.js";
import { similarityFromDistance } from "../utils";
import type { FaceMatchResult } from "../../types/kyc";

const FACE_MATCH_THRESHOLD = 0.52;

// ─── Types ─────────────────────────────────────────────────────────────────────

type WithLandmarks = faceapi.WithFaceLandmarks<
  { detection: faceapi.FaceDetection },
  faceapi.FaceLandmarks68
>;
type DetectionWithDescriptor = faceapi.WithFaceDescriptor<WithLandmarks>;

// ─── Yaw ───────────────────────────────────────────────────────────────────────

export function computeYawFromLandmarks(
  landmarks: faceapi.FaceLandmarks68,
): number {
  const pts = landmarks.positions;
  const nose = pts[30];
  const leftJaw = pts[0];
  const rightJaw = pts[16];
  const jawWidth = Math.max(1, rightJaw.x - leftJaw.x);
  const noseCenter = (nose.x - leftJaw.x) / jawWidth;
  return noseCenter - 0.5;
}

// ─── Quality ───────────────────────────────────────────────────────────────────

export function computeFaceQuality(detection: WithLandmarks): boolean {
  const box = detection.detection.box;
  return (
    box.width > 160 && box.height > 160 && detection.detection.score > 0.75
  );
}

// ─── Face size (for moveCloser challenge) ──────────────────────────────────────

export function computeFaceSizeRatio(
  detection: WithLandmarks,
  videoWidth: number,
): number {
  return detection.detection.box.width / Math.max(1, videoWidth);
}

// ─── SSD availability guard ────────────────────────────────────────────────────

function isSsdLoaded(): boolean {
  return faceapi.nets.ssdMobilenetv1.isLoaded;
}

// ─── Bicubic-quality upscale via stepped canvas ────────────────────────────────

/**
 * Browsers use bilinear interpolation for canvas drawImage.
 * Upscaling a tiny image in one step produces blurry results.
 * Stepping up in ≤2× increments produces much sharper results
 * (equivalent to bicubic for display purposes).
 *
 * Reference: https://stackoverflow.com/a/19144434
 */
function upscaleCanvas(
  source: HTMLCanvasElement | HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  let current = document.createElement("canvas");
  const srcW =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  current.width = srcW;
  current.height = srcH;
  current.getContext("2d")!.drawImage(source, 0, 0);

  while (current.width < targetWidth || current.height < targetHeight) {
    const nextW = Math.min(current.width * 2, targetWidth);
    const nextH = Math.min(current.height * 2, targetHeight);
    const next = document.createElement("canvas");
    next.width = nextW;
    next.height = nextH;
    next.getContext("2d")!.drawImage(current, 0, 0, nextW, nextH);
    current = next;
  }

  return current;
}

// ─── Face crop + normalize ─────────────────────────────────────────────────────

/**
 * Detects and crops the face region, then normalizes it to OUTPUT_SIZE.
 *
 * Why OUTPUT_SIZE = 400:
 *   - faceRecognitionNet resizes input to 150×150 internally.
 *   - Feeding it a 400×400 face (downscaled) is much better than
 *     feeding it a 123×164 face (upscaled from a tiny box).
 *   - 400px gives SSD enough pixels to reliably re-detect inside the crop.
 *   - Both selfie (399×372 box) and document (123×164 box) are normalized
 *     to the same canvas size → descriptors are computed under the same conditions.
 *
 * Why stepped upscaling:
 *   - Upscaling 123px → 400px in one step = blurry bilinear interpolation.
 *   - Stepping in ≤2× increments produces much sharper intermediate pixels.
 */
const OUTPUT_SIZE = 400;

async function cropAndNormalize(
  img: HTMLImageElement,
): Promise<HTMLCanvasElement> {
  let box: faceapi.Box | null = null;

  if (isSsdLoaded()) {
    const det = await faceapi
      .detectSingleFace(
        img,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }),
      )
      .withFaceLandmarks();
    box = det?.detection.box ?? null;
  }

  if (!box) {
    const det = await faceapi
      .detectSingleFace(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.2,
        }),
      )
      .withFaceLandmarks();
    box = det?.detection.box ?? null;
  }

  if (!box) {
    // No face — upscale full image to OUTPUT_SIZE so at least the
    // descriptor runs on a consistent canvas size
    return upscaleCanvas(img, OUTPUT_SIZE, OUTPUT_SIZE);
  }

  // Adaptive padding: minimum 50px, or 40% of the larger dimension
  const pad = Math.max(50, Math.max(box.width, box.height) * 0.4);
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const w = Math.min(img.naturalWidth - x, box.width + pad * 2);
  const h = Math.min(img.naturalHeight - y, box.height + pad * 2);

  // First crop at native resolution
  const nativeCanvas = document.createElement("canvas");
  nativeCanvas.width = Math.round(w);
  nativeCanvas.height = Math.round(h);
  nativeCanvas
    .getContext("2d")!
    .drawImage(img, x, y, w, h, 0, 0, nativeCanvas.width, nativeCanvas.height);

  // Then upscale to OUTPUT_SIZE using stepped interpolation
  return upscaleCanvas(nativeCanvas, OUTPUT_SIZE, OUTPUT_SIZE);
}

// ─── Descriptor ────────────────────────────────────────────────────────────────

async function getDescriptorFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<DetectionWithDescriptor | null> {
  if (isSsdLoaded()) {
    const det = await faceapi
      .detectSingleFace(
        canvas,
        new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (det) return det;
  }

  const det = await faceapi
    .detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.2,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  return det ?? null;
}

/**
 * Extracts the best possible face descriptor from any image source.
 *
 * Still images (selfie + document):
 *   1. Crop and normalize to OUTPUT_SIZE using stepped upscaling.
 *   2. Run descriptor on the normalized canvas.
 *   3. If that fails, fall back to the full original image.
 *
 * Live video (liveness frames):
 *   - No cropping. TinyFaceDetector only (speed matters here).
 */
export async function getBestFaceDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<DetectionWithDescriptor> {
  const isStillImage = input instanceof HTMLImageElement;

  // ── Still image path ───────────────────────────────────────────────────────
  if (isStillImage) {
    // Step 1: crop + normalize
    const normalized = await cropAndNormalize(input);

    // Step 2: descriptor on normalized canvas
    const detNorm = await getDescriptorFromCanvas(normalized);
    if (detNorm) return detNorm;

    // Step 3: fallback — descriptor on full original image
    if (isSsdLoaded()) {
      const detFull = await faceapi
        .detectSingleFace(
          input,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.1 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (detFull) return detFull;
    }

    const detTinyFull = await faceapi
      .detectSingleFace(
        input,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.15,
        }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detTinyFull) return detTinyFull;

    throw new Error("No face detected in image.");
  }

  // ── Live video path ────────────────────────────────────────────────────────
  const detVideo = await faceapi
    .detectSingleFace(
      input,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.45,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (detVideo) return detVideo;

  throw new Error("No face detected in video frame.");
}

// ─── Match ─────────────────────────────────────────────────────────────────────

export function getFaceMatchVerdict(distance: number): FaceMatchResult {
  const similarity = similarityFromDistance(distance);
  const passed = distance < FACE_MATCH_THRESHOLD;
  return {
    distance: Number(distance.toFixed(4)),
    similarity,
    threshold: FACE_MATCH_THRESHOLD,
    passed,
    status: passed ? "pass" : "review",
  };
}
