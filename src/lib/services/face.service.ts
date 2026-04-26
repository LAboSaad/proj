// src/lib/services/face.service.ts
import * as faceapi from "face-api.js";
import { similarityFromDistance } from "../utils";
import type { FaceMatchResult } from "../../types/kyc";

const FACE_MATCH_THRESHOLD = 0.52;

// ─── Yaw ──────────────────────────────────────────────────────────────────────

export function computeYawFromLandmarks(landmarks: faceapi.FaceLandmarks68): number {
  const pts = landmarks.positions;
  const nose = pts[30];
  const leftJaw = pts[0];
  const rightJaw = pts[16];
  const jawWidth = Math.max(1, rightJaw.x - leftJaw.x);
  const noseCenter = (nose.x - leftJaw.x) / jawWidth;
  return noseCenter - 0.5;
}

// ─── Quality ──────────────────────────────────────────────────────────────────

export function computeFaceQuality(
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>
): boolean {
  const box = detection.detection.box;
  return box.width > 160 && box.height > 160 && detection.detection.score > 0.75;
}

// ─── Face size (for moveCloser challenge) ─────────────────────────────────────

/**
 * Returns face bounding box width as a fraction of video width.
 * A value > 0.35 means the face is close enough.
 */
export function computeFaceSizeRatio(
  detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>,
  videoWidth: number
): number {
  const boxWidth = detection.detection.box.width;
  return boxWidth / Math.max(1, videoWidth);
}


// ─── Descriptor ───────────────────────────────────────────────────────────────

export async function getBestFaceDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>>> {
  const detection = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!detection) throw new Error("No face detected.");
  return detection;
}

// ─── Match ────────────────────────────────────────────────────────────────────

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