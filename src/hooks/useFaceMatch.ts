// src/hooks/useFaceMatch.ts
import { useCallback, useState } from "react";
import * as faceapi from "face-api.js";
import { getBestFaceDescriptor, getFaceMatchVerdict } from "../lib/services/face.service";
import { dataUrlToImage } from "../utils/image";
import type { FaceMatchResult } from "../types/kyc";

interface UseFaceMatchProps {
  selfieImage: string;
  documentImage: string;
  pushError: (scope: string, message: string) => void;
  clearError: () => void;
  nextStep: () => void;
}

interface UseFaceMatchReturn {
  faceMatch: FaceMatchResult | null;
  busy: boolean;
  runFaceMatch: () => Promise<void>;
  resetFaceMatch: () => void;
}

export function useFaceMatch({
  selfieImage,
  documentImage,
  pushError,
  clearError,
  nextStep,
}: UseFaceMatchProps): UseFaceMatchReturn {
  const [faceMatch, setFaceMatch] = useState<FaceMatchResult | null>(null);
  const [busy, setBusy]           = useState(false);

  const runFaceMatch = useCallback(async (): Promise<void> => {
    if (!selfieImage || !documentImage) {
      pushError("face-match", "Selfie and document image are both required.");
      return;
    }

    try {
      clearError();
      setBusy(true);

      const [selfie, documentImg] = await Promise.all([
        dataUrlToImage(selfieImage),
        dataUrlToImage(documentImage),
      ]);

      const [selfieDetection, docDetection] = await Promise.all([
        getBestFaceDescriptor(selfie),
        getBestFaceDescriptor(documentImg),
      ]);

      const matcher = new faceapi.FaceMatcher([
        new faceapi.LabeledFaceDescriptors("selfie", [selfieDetection.descriptor]),
      ]);

      const result  = matcher.findBestMatch(docDetection.descriptor);
      const verdict = getFaceMatchVerdict(result.distance);

      setFaceMatch(verdict);
      nextStep();
    } catch (err) {
      pushError(
        "face-match",
        err instanceof Error
          ? `${err.message} Ensure both images contain one clear face.`
          : "Face match failed."
      );
    } finally {
      setBusy(false);
    }
  }, [selfieImage, documentImage, pushError, clearError, nextStep]);

  const resetFaceMatch = useCallback(() => {
    setFaceMatch(null);
  }, []);

  return {
    faceMatch,
    busy,
    runFaceMatch,
    resetFaceMatch,
  };
}