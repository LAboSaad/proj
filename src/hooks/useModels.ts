// src/hooks/useModels.ts
import { useEffect, useState } from "react";
import * as faceapi from "face-api.js";
import { loadGestureModels } from "../lib/services/gesture.service";

interface UseModelsReturn {
  modelsLoaded: boolean;
  busy: boolean;
}

export function useModels(
  pushError: (scope: string, message: string) => void
): UseModelsReturn {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load(): Promise<void> {
      try {
        setBusy(true);

        // ── Phase 1: face-api — unblocks face detection immediately ──────────
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);

        console.log("✅ Face-api models loaded");

        if (mounted) {
          setModelsLoaded(true);
          setBusy(false);
        }

        // ── Phase 2: MediaPipe in background — does not block face detection ──
        loadGestureModels().catch((err: unknown) => {
          console.error("❌ Gesture model load failed:", err);
          if (mounted) {
            pushError(
              "models",
              `Gesture model loading failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        });

      } catch (err) {
        console.error("❌ Face-api model load failed:", err);
        if (mounted) {
          pushError(
            "models",
            `Model loading failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
          setBusy(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [pushError]);

  return { modelsLoaded, busy };
}