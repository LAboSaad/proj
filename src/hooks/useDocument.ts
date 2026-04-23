// src/hooks/useDocument.ts
import { useCallback, useState } from "react";
import type { RefObject } from "react";
import Webcam from "react-webcam";
import { analyzeDocumentQuality } from "../lib/quality";
import { detectPossibleSpoof } from "../lib/services/spoof.service";
import { fileToDataUrl, dataUrlToImage, getCanvasFromImage, canvasToBlob } from "../utils/image";
import type { DocumentQuality } from "../types/kyc";

interface UseDocumentProps {
  docWebcamRef: RefObject<Webcam | null>;
  pushError: (scope: string, message: string) => void;
  clearError: () => void;
}

interface UseDocumentReturn {
  documentImage: string;
  documentQuality: DocumentQuality | null;
  documentPreviewMode: "camera" | "upload";
  setDocumentPreviewMode: (mode: "camera" | "upload") => void;
  captureDocument: () => Promise<void>;
  handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  saveDocumentBlobLocally: () => Promise<void>;
  resetDocument: () => void;
}

export function useDocument({
  docWebcamRef,
  pushError,
  clearError,
}: UseDocumentProps): UseDocumentReturn {
  const [documentImage, setDocumentImage]             = useState("");
  const [documentQuality, setDocumentQuality]         = useState<DocumentQuality | null>(null);
  const [documentPreviewMode, setDocumentPreviewMode] = useState<"camera" | "upload">("camera");

  const captureDocument = useCallback(async (): Promise<void> => {
    try {
      clearError();

      if (!docWebcamRef.current) throw new Error("Webcam not ready.");

      const dataUrl = docWebcamRef.current.getScreenshot({ width: 1920, height: 1080 });
      if (!dataUrl) throw new Error("Could not capture document image.");

      const spoof = await detectPossibleSpoof(dataUrl);
      if (spoof) {
        pushError("security", "Possible screen/replay attack detected.");
        return;
      }

      const quality = await analyzeDocumentQuality(dataUrl);
      setDocumentQuality(quality);
      setDocumentImage(dataUrl);
    } catch (err) {
      pushError(
        "document",
        err instanceof Error ? err.message : "Document capture failed."
      );
    }
  }, [docWebcamRef, pushError, clearError]);

  const handleDocumentUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;

        clearError();

        const dataUrl = await fileToDataUrl(file);
        const quality = await analyzeDocumentQuality(dataUrl);

        setDocumentImage(dataUrl);
        setDocumentQuality(quality);

        if (!quality.looksUsefulForOCR) {
          pushError(
            "document-quality",
            quality.reasons[0] ?? "Image quality is weak for OCR. Results may be poor."
          );
        }
      } catch (err) {
        pushError(
          "document",
          err instanceof Error ? err.message : "Could not read uploaded document image."
        );
      }
    },
    [clearError, pushError]
  );

  const saveDocumentBlobLocally = useCallback(async (): Promise<void> => {
    if (!documentImage) return;

    try {
      const image  = await dataUrlToImage(documentImage);
      const canvas = getCanvasFromImage(image);
      const blob   = await canvasToBlob(canvas);
      const url    = URL.createObjectURL(blob);

      const anchor      = document.createElement("a");
      anchor.href       = url;
      anchor.download   = `document-capture-${Date.now()}.jpg`;
      anchor.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      pushError(
        "document",
        err instanceof Error ? err.message : "Failed to save document locally."
      );
    }
  }, [documentImage, pushError]);

  const resetDocument = useCallback(() => {
    setDocumentImage("");
    setDocumentQuality(null);
    setDocumentPreviewMode("camera");
  }, []);

  return {
    documentImage,
    documentQuality,
    documentPreviewMode,
    setDocumentPreviewMode,
    captureDocument,
    handleDocumentUpload,
    saveDocumentBlobLocally,
    resetDocument,
  };
}