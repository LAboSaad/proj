// src/lib/loadModels.ts
//
// Call this once at app startup (e.g. in your KYC page's useEffect).
// Loads face-api.js models AND MediaPipe gesture models in parallel.

import * as faceapi from "face-api.js";
import { loadGestureModels } from "./services/gesture.service";

const MODELS_URL = "/models"; // your existing face-api model path

export async function loadAllModels(): Promise<void> {
  await Promise.all([
    // ── face-api.js (existing) ─────────────────────────────────────────────
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),

    // ── MediaPipe (new) ────────────────────────────────────────────────────
    // Downloads ~4MB of WASM + model files from CDN on first load.
    // Cached by the browser after first visit.
    loadGestureModels(),
  ]);
}