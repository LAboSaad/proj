// src/lib/services/gesture.service.ts
//
// Wraps MediaPipe HandLandmarker and PoseLandmarker as singletons.
// Models are loaded once and reused across all detection calls.

import {
  HandLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ── Constants ─────────────────────────────────────────────────────────────────

const MEDIAPIPE_WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// ── Singletons ────────────────────────────────────────────────────────────────

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let gestureModelsLoaded = false;

// Stored so concurrent callers await the same promise rather than
// triggering parallel downloads. Reset to null on failure so a
// retry attempt starts a fresh load instead of re-awaiting a rejected promise.
let loadingPromise: Promise<void> | null = null;

// ── Init ──────────────────────────────────────────────────────────────────────

export async function loadGestureModels(): Promise<void> {
  if (gestureModelsLoaded) return;

  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

    [handLandmarker, poseLandmarker] = await Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    ]);

    gestureModelsLoaded = true;
  })();

  // Reset loadingPromise on failure so the next call retries cleanly
  loadingPromise.catch(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export function areGestureModelsLoaded(): boolean {
  return gestureModelsLoaded;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type GestureFrame = {
  hands: HandLandmarkerResult;
  pose: PoseLandmarkerResult;
};

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Runs hand and pose detection on a single video frame.
 * Returns null if models are not yet loaded — callers should guard with
 * areGestureModelsLoaded() before calling.
 */
export function detectGestures(video: HTMLVideoElement): GestureFrame | null {
  if (!handLandmarker || !poseLandmarker) return null;

  const ts = performance.now();
  return {
    hands: handLandmarker.detectForVideo(video, ts),
    pose: poseLandmarker.detectForVideo(video, ts),
  };
}

// ── Evaluators ────────────────────────────────────────────────────────────────

export function isRaisingLeftHand(pose: PoseLandmarkerResult): boolean {
  const lm = pose.landmarks?.[0];
  if (!lm) return false;
  const leftWrist = lm[15];
  const leftShoulder = lm[11];
  if (!leftWrist || !leftShoulder) return false;
  return leftWrist.y < leftShoulder.y - 0.05;
}

export function isRaisingRightHand(pose: PoseLandmarkerResult): boolean {
  const lm = pose.landmarks?.[0];
  if (!lm) return false;
  const rightWrist = lm[16];
  const rightShoulder = lm[12];
  if (!rightWrist || !rightShoulder) return false;
  return rightWrist.y < rightShoulder.y - 0.05;
}

export function computePitchFromPose(
  pose: PoseLandmarkerResult,
): number | null {
  const lm = pose.landmarks?.[0];
  if (!lm) return null;
  const nose = lm[0];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  if (!nose || !leftShoulder || !rightShoulder) return null;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  return nose.y - shoulderMidY;
}
