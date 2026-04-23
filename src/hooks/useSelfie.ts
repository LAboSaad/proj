// src/hooks/useSelfie.ts
import { useCallback, useState } from "react";
import type { RefObject } from "react";
import Webcam from "react-webcam";
import { detectPossibleSpoof } from "../lib/services/spoof.service";
import { getBestFaceDescriptor } from "../lib/services/face.service";
import { dataUrlToImage } from "../utils/image";

interface UseSelfieProps {
  webcamRef: RefObject<Webcam | null>;
  livenessDone: boolean;
  pushError: (scope: string, message: string) => void;
  clearError: () => void;
  nextStep: () => void;
}

interface UseSelfieReturn {
  selfieImage: string;
  setSelfieImage: (v: string) => void;
  captureSelfie: () => Promise<void>;
  resetSelfie: () => void;
}

export function useSelfie({
  webcamRef,
  livenessDone,
  pushError,
  clearError,
  nextStep,
}: UseSelfieProps): UseSelfieReturn {
  const [selfieImage, setSelfieImage] = useState("");

  const captureSelfie = useCallback(async (): Promise<void> => {
    try {
      clearError();

      if (!livenessDone) {
        pushError("liveness", "Complete liveness check first.");
        return;
      }

      const dataUrl = webcamRef.current?.getScreenshot();
      if (!dataUrl) throw new Error("Webcam screenshot failed.");

      const spoof = await detectPossibleSpoof(dataUrl);
      if (spoof) {
        pushError("security", "Possible spoof detected (screen/photo). Please try again.");
        return;
      }

      await getBestFaceDescriptor(await dataUrlToImage(dataUrl));

      setSelfieImage(dataUrl);
      nextStep();
    } catch (err) {
      pushError(
        "selfie",
        err instanceof Error ? err.message : "Selfie capture failed."
      );
    }
  }, [webcamRef, livenessDone, pushError, clearError, nextStep]);

  const resetSelfie = useCallback(() => {
    setSelfieImage("");
  }, []);

  return {
    selfieImage,
    setSelfieImage,
    captureSelfie,
    resetSelfie,
  };
}