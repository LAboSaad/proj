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

/**
 * react-webcam with mirrored=true returns a horizontally flipped screenshot.
 * We must un-mirror it before storing or passing to face-api, otherwise the
 * descriptor geometry is flipped relative to the document photo.
 */
function unmirrорDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      // Flip horizontally
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
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

  const captureSelfieSide = useCallback(
    async (dataUrl: string): Promise<void> => {
      try {
        if (!dataUrl) return;
        const unmirrored = await unmirrорDataUrl(dataUrl);
        setSelfieSideImage(unmirrored);
      } catch {
        // non-critical
      }
    },
    [],
  );

  const captureFaceSidePhoto = useCallback(async (): Promise<void> => {
    try {
      const dataUrl = webcamRef.current?.getScreenshot({
        width: 1280,
        height: 720,
      });
      if (!dataUrl) return;
      const unmirrored = await unmirrорDataUrl(dataUrl);
      setFaceSidePhoto(unmirrored);
      nextStep();
    } catch {
      // non-critical
    }
  }, [webcamRef, nextStep]);

  const captureSelfie = useCallback(async (): Promise<void> => {
    try {
      clearError();

      if (!livenessDone) {
        pushError("liveness", "Complete liveness check first.");
        return;
      }

      const dataUrl = webcamRef.current?.getScreenshot({
        width: 1280,
        height: 720,
      });
      if (!dataUrl) throw new Error("Webcam screenshot failed.");

      // Un-mirror before spoof check and descriptor extraction
      const unmirrored = await unmirrорDataUrl(dataUrl);

      const spoof = await detectPossibleSpoof(unmirrored);
      if (spoof) {
        pushError(
          "security",
          "Possible spoof detected (screen/photo). Please try again.",
        );
        return;
      }

      await getBestFaceDescriptor(await dataUrlToImage(unmirrored));

      setSelfieImage(unmirrored);
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
