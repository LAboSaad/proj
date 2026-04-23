// src/hooks/useModels.ts
import {  useEffect, useState } from "react";
import * as faceapi from "face-api.js";

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

    async function loadModels(): Promise<void> {
      try {
        setBusy(true);

        await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
        await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
        await faceapi.nets.faceRecognitionNet.loadFromUri("/models");

        if (mounted) setModelsLoaded(true);
      } catch (err) {
        if (mounted) {
          pushError(
            "models",
            `Model loading failed: ${err instanceof Error ? err.message : "unknown error"}`
          );
        }
      } finally {
        if (mounted) setBusy(false);
      }
    }

    void loadModels();

    return () => {
      mounted = false;
    };
  }, [pushError]);

  return { modelsLoaded, busy };
}