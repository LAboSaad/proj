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
  selfieSideImage: string;
  faceSidePhoto: string;
  setSelfieImage: (v: string) => void;
  captureSelfie: () => Promise<void>;
  captureSelfieSide: (dataUrl: string) => Promise<void>;
  captureFaceSidePhoto: () => Promise<void>;
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
  const [selfieSideImage, setSelfieSideImage] = useState("");
  const [faceSidePhoto, setFaceSidePhoto] = useState("");

  // Called automatically when lookLeft or lookRight challenge passes
  const captureSelfieSide = useCallback(
    async (dataUrl: string): Promise<void> => {
      try {
        if (!dataUrl) return;
        setSelfieSideImage(dataUrl);
      } catch {
        // non-critical
      }
    },
    [],
  );

  // Captures the side photo then advances to the next step
  const captureFaceSidePhoto = useCallback(async (): Promise<void> => {
    try {
      const dataUrl = webcamRef.current?.getScreenshot();
      if (!dataUrl) return;
      setFaceSidePhoto(dataUrl);
      nextStep();
    } catch {
      // non-critical
    }
  }, [webcamRef, nextStep]);

  // Captures the front selfie only — does NOT advance the step
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
        pushError(
          "security",
          "Possible spoof detected (screen/photo). Please try again.",
        );
        return;
      }

      await getBestFaceDescriptor(await dataUrlToImage(dataUrl));

      // Save the front selfie but stay on this step
      setSelfieImage(dataUrl);
    } catch (err) {
      pushError(
        "selfie",
        err instanceof Error ? err.message : "Selfie capture failed.",
      );
    }
  }, [webcamRef, livenessDone, pushError, clearError]);

  const resetSelfie = useCallback(() => {
    setSelfieImage("");
    setSelfieSideImage("");
    setFaceSidePhoto("");
  }, []);

  return {
    selfieImage,
    selfieSideImage,
    faceSidePhoto,
    setSelfieImage,
    captureSelfie,
    captureSelfieSide,
    captureFaceSidePhoto,
    resetSelfie,
  };
}