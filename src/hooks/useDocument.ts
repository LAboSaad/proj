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
  documentBackImage: string;
  documentBackQuality: DocumentQuality | null;
  documentPreviewMode: "camera" | "upload";
  setDocumentPreviewMode: (mode: "camera" | "upload") => void;
  captureDocument: () => Promise<void>;
  captureDocumentBack: () => Promise<void>;
  handleDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDocumentBackUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  saveDocumentBlobLocally: () => Promise<void>;
  saveDocumentBackBlobLocally: () => Promise<void>;
  resetDocument: () => void;
}

export function useDocument({
  docWebcamRef,
  pushError,
  clearError,
}: UseDocumentProps): UseDocumentReturn {
  const [documentImage, setDocumentImage]               = useState("");
  const [documentQuality, setDocumentQuality]           = useState<DocumentQuality | null>(null);
  const [documentBackImage, setDocumentBackImage]       = useState("");
  const [documentBackQuality, setDocumentBackQuality]   = useState<DocumentQuality | null>(null);
  const [documentPreviewMode, setDocumentPreviewMode]   = useState<"camera" | "upload">("camera");

  // ── helpers ────────────────────────────────────────────────────────────────
  const captureFromWebcam = useCallback(async (): Promise<string> => {
    if (!docWebcamRef.current) throw new Error("Webcam not ready.");
    const dataUrl = docWebcamRef.current.getScreenshot({ width: 1920, height: 1080 });
    if (!dataUrl) throw new Error("Could not capture image.");
    return dataUrl;
  }, [docWebcamRef]);

  const saveImageLocally = useCallback(async (dataUrl: string, filename: string): Promise<void> => {
    const image  = await dataUrlToImage(dataUrl);
    const canvas = getCanvasFromImage(image);
    const blob   = await canvasToBlob(canvas);
    const url    = URL.createObjectURL(blob);
    const anchor      = document.createElement("a");
    anchor.href       = url;
    anchor.download   = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── front document ─────────────────────────────────────────────────────────
  const captureDocument = useCallback(async (): Promise<void> => {
    try {
      clearError();
      const dataUrl = await captureFromWebcam();
      const spoof = await detectPossibleSpoof(dataUrl);
      if (spoof) { pushError("security", "Possible screen/replay attack detected."); return; }
      const quality = await analyzeDocumentQuality(dataUrl);
      setDocumentQuality(quality);
      setDocumentImage(dataUrl);
    } catch (err) {
      pushError("document", err instanceof Error ? err.message : "Document capture failed.");
    }
  }, [captureFromWebcam, pushError, clearError]);

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
          pushError("document-quality", quality.reasons[0] ?? "Image quality is weak for OCR.");
        }
      } catch (err) {
        pushError("document", err instanceof Error ? err.message : "Could not read uploaded document image.");
      }
    },
    [clearError, pushError]
  );

  const saveDocumentBlobLocally = useCallback(async (): Promise<void> => {
    if (!documentImage) return;
    try {
      await saveImageLocally(documentImage, `document-front-${Date.now()}.jpg`);
    } catch (err) {
      pushError("document", err instanceof Error ? err.message : "Failed to save document locally.");
    }
  }, [documentImage, saveImageLocally, pushError]);

  // ── back document ──────────────────────────────────────────────────────────
  const captureDocumentBack = useCallback(async (): Promise<void> => {
    try {
      clearError();
      const dataUrl = await captureFromWebcam();
      const spoof = await detectPossibleSpoof(dataUrl);
      if (spoof) { pushError("security", "Possible screen/replay attack detected."); return; }
      const quality = await analyzeDocumentQuality(dataUrl);
      setDocumentBackQuality(quality);
      setDocumentBackImage(dataUrl);
    } catch (err) {
      pushError("document-back", err instanceof Error ? err.message : "Back document capture failed.");
    }
  }, [captureFromWebcam, pushError, clearError]);

  const handleDocumentBackUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      try {
        const file = e.target.files?.[0];
        if (!file) return;
        clearError();
        const dataUrl = await fileToDataUrl(file);
        const quality = await analyzeDocumentQuality(dataUrl);
        setDocumentBackImage(dataUrl);
        setDocumentBackQuality(quality);
        if (!quality.looksUsefulForOCR) {
          pushError("document-back-quality", quality.reasons[0] ?? "Back image quality is weak.");
        }
      } catch (err) {
        pushError("document-back", err instanceof Error ? err.message : "Could not read uploaded back image.");
      }
    },
    [clearError, pushError]
  );

  const saveDocumentBackBlobLocally = useCallback(async (): Promise<void> => {
    if (!documentBackImage) return;
    try {
      await saveImageLocally(documentBackImage, `document-back-${Date.now()}.jpg`);
    } catch (err) {
      pushError("document-back", err instanceof Error ? err.message : "Failed to save back document locally.");
    }
  }, [documentBackImage, saveImageLocally, pushError]);

  // ── reset ──────────────────────────────────────────────────────────────────
  const resetDocument = useCallback(() => {
    setDocumentImage("");
    setDocumentQuality(null);
    setDocumentBackImage("");
    setDocumentBackQuality(null);
    setDocumentPreviewMode("camera");
  }, []);

  return {
    documentImage,
    documentQuality,
    documentBackImage,
    documentBackQuality,
    documentPreviewMode,
    setDocumentPreviewMode,
    captureDocument,
    captureDocumentBack,
    handleDocumentUpload,
    handleDocumentBackUpload,
    saveDocumentBlobLocally,
    saveDocumentBackBlobLocally,
    resetDocument,
  };
}