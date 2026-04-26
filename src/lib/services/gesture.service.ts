// src/lib/services/gesture.service.ts
import {
  HandLandmarker,
  PoseLandmarker,
  FilesetResolver,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from "@mediapipe/tasks-vision";

// ─── Singletons ───────────────────────────────────────────────────────────────

let handLandmarker: HandLandmarker | null = null;
let poseLandmarker: PoseLandmarker | null = null;
let gestureModelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

export async function loadGestureModels(): Promise<void> {
  if (gestureModelsLoaded) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    console.log("⏳ Loading gesture models...");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm"
    );

    [handLandmarker, poseLandmarker] = await Promise.all([
      HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      }),
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
    ]);

    gestureModelsLoaded = true;
    console.log("✅ Gesture models loaded");
  })();

  return loadingPromise;
}

export function areGestureModelsLoaded(): boolean {
  return gestureModelsLoaded;
}

// ─── Detection ────────────────────────────────────────────────────────────────

export type GestureFrame = {
  hands: HandLandmarkerResult;
  pose: PoseLandmarkerResult;
};

export function detectGestures(video: HTMLVideoElement): GestureFrame | null {
  if (!handLandmarker || !poseLandmarker) return null;
  const ts = performance.now();
  return {
    hands: handLandmarker.detectForVideo(video, ts),
    pose: poseLandmarker.detectForVideo(video, ts),
  };
}

// ─── Evaluators ───────────────────────────────────────────────────────────────

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

export function computePitchFromPose(pose: PoseLandmarkerResult): number | null {
  const lm = pose.landmarks?.[0];
  if (!lm) return null;
  const nose = lm[0];
  const leftShoulder = lm[11];
  const rightShoulder = lm[12];
  if (!nose || !leftShoulder || !rightShoulder) return null;
  const shoulderMidY = (leftShoulder.y + rightShoulder.y) / 2;
  return nose.y - shoulderMidY;
}