// src/lib/services/video.service.ts

import * as faceapi from "face-api.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const VIDEO_READY_POLL_MS = 100;
const VIDEO_READY_TIMEOUT_MS = 10_000; // 10 s — avoids hanging forever
const FACE_RETRY_DELAY_MS = 150;

// ── Video readiness ───────────────────────────────────────────────────────────

/**
 * Resolves when the video element has data and a non-zero width.
 * Rejects after VIDEO_READY_TIMEOUT_MS to prevent hanging if the
 * camera stream never becomes ready (e.g. permission denied mid-flow).
 */
export function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState === 4 && video.videoWidth > 0) {
      resolve();
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearInterval(intervalId);
      reject(new Error("Timed out waiting for video to become ready."));
    }, VIDEO_READY_TIMEOUT_MS);

    const intervalId = window.setInterval(() => {
      if (video.readyState === 4 && video.videoWidth > 0) {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
        resolve();
      }
    }, VIDEO_READY_POLL_MS);
  });
}

// ── Face detection with retry ─────────────────────────────────────────────────

type DetectionResult = faceapi.WithFaceLandmarks<
  { detection: faceapi.FaceDetection },
  faceapi.FaceLandmarks68
>;

/**
 * Attempts face detection up to `retries` times with a short delay between
 * attempts. Returns null if no face is found after all retries.
 */
export async function detectFaceWithRetry(
  video: HTMLVideoElement,
  retries = 3,
): Promise<DetectionResult | null> {
  for (let i = 0; i < retries; i++) {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 416,
          scoreThreshold: 0.3,
        }),
      )
      .withFaceLandmarks();

    if (detection) return detection;

    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, FACE_RETRY_DELAY_MS));
    }
  }

  return null;
}
