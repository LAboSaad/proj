// src/hooks/useModels.ts
//
// Loads face-api.js and MediaPipe models in a prioritised sequence:
//
//   Phase 1 (blocking): TinyFaceDetector + FaceLandmark + FaceRecognition
//     → sets modelsLoaded = true, unblocking the liveness step immediately
//
//   Phase 2 (background): SsdMobilenetv1
//     → improves face-match accuracy once ready; falls back to Tiny if it fails
//
//   Phase 3 (background): MediaPipe gesture models
//     → enables hand/pose challenges; challenge types requiring pose are
//       guarded by areGestureModelsLoaded() in useFaceLiveness

import { useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { loadGestureModels } from "../lib/services/gesture.service";

const MODELS_URL = "/models";

interface UseModelsReturn {
  modelsLoaded: boolean;
}

export function useModels(
  pushError: (scope: string, message: string) => void,
): UseModelsReturn {
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        // ── Phase 1: core models — blocks until liveness is ready ─────────
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ]);

        if (mounted) setModelsLoaded(true);

        // ── Phase 2: SSD — improves face match, non-blocking ─────────────
        faceapi.nets.ssdMobilenetv1
          .loadFromUri(MODELS_URL)
          .catch((err: unknown) => {
            if (mounted) {
              pushError(
                "models",
                `SSD model failed to load: ${err instanceof Error ? err.message : String(err)}. Face match will use TinyFaceDetector as fallback.`,
              );
            }
          });

        // ── Phase 3: MediaPipe — enables gesture challenges, non-blocking ─
        loadGestureModels().catch((err: unknown) => {
          if (mounted) {
            pushError(
              "models",
              `Gesture model failed to load: ${err instanceof Error ? err.message : String(err)}.`,
            );
          }
        });
      } catch (err) {
        if (mounted) {
          pushError(
            "models",
            `Core model loading failed: ${err instanceof Error ? err.message : "unknown error"}`,
          );
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [pushError]);

  return { modelsLoaded };
}
