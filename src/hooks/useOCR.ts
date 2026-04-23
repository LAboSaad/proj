// src/hooks/useOCR.ts
import { useCallback, useState } from "react";
import Tesseract from "tesseract.js";
import { parse as parseMRZ } from "mrz";
import { cropMRZRegion, extractMRZLines, normalizeMRZText, preprocessMRZCanvas } from "../lib/ocr";
import { dataUrlToImage } from "../utils/image";
import { formatDateYYMMDD } from "../lib/utils";
import { initialFields } from "../lib/constants/kyc.constants";
import type { ExtractedFields } from "../types/kyc";

interface UseOCRProps {
  documentImage: string;
  pushError: (scope: string, message: string) => void;
  clearError: () => void;
  nextStep: () => void;
}

interface UseOCRReturn {
  fields: ExtractedFields;
  setFields: React.Dispatch<React.SetStateAction<ExtractedFields>>;
  ocrProgress: number;
  mrzValid: boolean | null;
  mrzMessage: string;
  busy: boolean;
  runOCRAndMRZ: () => Promise<void>;
  resetOCR: () => void;
}

async function runOCR(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
): Promise<Tesseract.RecognizeResult> {
  return Tesseract.recognize(canvas, "eng", {
    logger: (info: any) => {
      if (info.status === "recognizing text" && onProgress) {
        onProgress(Math.round((info.progress || 0) * 100));
      }
    },
    config: {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    },
  } as any);
}

export function useOCR({
  documentImage,
  pushError,
  clearError,
  nextStep,
}: UseOCRProps): UseOCRReturn {
  const [fields, setFields]         = useState<ExtractedFields>(initialFields);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [mrzValid, setMrzValid]     = useState<boolean | null>(null);
  const [mrzMessage, setMrzMessage] = useState("");
  const [busy, setBusy]             = useState(false);

  const runOCRAndMRZ = useCallback(async (): Promise<void> => {
    if (!documentImage) {
      pushError("ocr", "Capture or upload a document image first.");
      return;
    }

    try {
      clearError();
      setBusy(true);
      setOcrProgress(0);
      setMrzValid(null);
      setMrzMessage("");

      // ── Step 1: load image ──────────────────────────────────────────
      const img = await dataUrlToImage(documentImage);

      // ── Step 2: crop MRZ region ─────────────────────────────────────
      const mrzCanvas = cropMRZRegion(img);

      // ── Step 3: preprocess ──────────────────────────────────────────
      const processedCanvas = await preprocessMRZCanvas(mrzCanvas);

      // ── Step 4: dual OCR pass ───────────────────────────────────────
      const [raw, processed] = await Promise.all([
        runOCR(mrzCanvas, setOcrProgress),
        runOCR(processedCanvas, setOcrProgress),
      ]);

      const rawText       = raw.data.text || "";
      const processedText = processed.data.text || "";

      // ── Step 5: pick best pass ──────────────────────────────────────
      const score = (t: string) => t.replace(/[^A-Z0-9<]/g, "").length;
      const bestText = score(processedText) > score(rawText) ? processedText : rawText;

      // ── Step 6: normalize ───────────────────────────────────────────
      const cleaned = normalizeMRZText(bestText);

      // ── Step 7: extract lines ───────────────────────────────────────
      let lines = extractMRZLines(cleaned);

      let parsed: any    = null;
      let mrzSource      = "";
      let message        = "No MRZ detected.";

      if (lines.length >= 2) {
        lines = lines.slice(0, 2);

        // ── Step 8: safe fixing ─────────────────────────────────────
        const fixedLines = lines.map((line) => {
          let l = line;
          l = l.replace(/[^A-Z0-9<]/g, "");
          l = l.replace(/^0P/, "P<");
          l = l.replace(/^OP/, "P<");
          if (l.length < 44) l = l.padEnd(44, "<");
          if (l.length > 44) l = l.slice(0, 44);
          return l;
        });

        // ── Step 9: parse ───────────────────────────────────────────
        try {
          parsed = parseMRZ(fixedLines);
          message = parsed.valid
            ? "MRZ parsed successfully."
            : "MRZ format detected, but check digits invalid (sample or OCR noise).";
          mrzSource = fixedLines.join("\n");
        } catch {
          message   = "MRZ detected but unreadable.";
          mrzSource = fixedLines.join("\n");
        }
      }

      // ── Step 10: populate fields ────────────────────────────────────
      if (parsed?.fields) {
        const d = parsed.fields;

        setFields({
          firstName:      (d.firstName     || "").replace(/</g, " ").trim(),
          lastName:       (d.lastName      || "").replace(/</g, " ").trim(),
          documentNumber: (d.documentNumber || "").replace(/</g, "").trim(),
          nationality:    (d.nationality   || "").trim(),
          birthDate:      d.birthDate        ? formatDateYYMMDD(d.birthDate)       : "",
          expiryDate:     d.expirationDate   ? formatDateYYMMDD(d.expirationDate)  : "",
          sex:            (d.sex            || "").toUpperCase(),
          rawMRZ:         mrzSource,
          rawOCRText:     cleaned,
        });

        setMrzValid(parsed.valid);
        setMrzMessage(message);
      } else {
        setFields((prev) => ({ ...prev, rawMRZ: mrzSource, rawOCRText: cleaned }));
        setMrzValid(false);
        setMrzMessage(message);
      }

      nextStep();
    } catch (err) {
      pushError(
        "ocr",
        err instanceof Error ? err.message : "OCR failed."
      );
    } finally {
      setBusy(false);
    }
  }, [documentImage, clearError, pushError, nextStep]);

  const resetOCR = useCallback(() => {
    setFields(initialFields);
    setOcrProgress(0);
    setMrzValid(null);
    setMrzMessage("");
  }, []);

  return {
    fields,
    setFields,
    ocrProgress,
    mrzValid,
    mrzMessage,
    busy,
    runOCRAndMRZ,
    resetOCR,
  };
}