// src/hooks/useOCR.ts
//
// Orchestrates the full OCR + MRZ pipeline for a captured document image.
//
// Pipeline:
//   1. Detect document type (passport / national-id / licence)
//   2. Crop the MRZ region based on document type
//   3. Run two Tesseract passes in parallel: raw crop + preprocessed crop
//   4. Pick the pass with the most valid MRZ characters
//   5. Normalise and extract MRZ lines
//   6. Fix common line-length issues and parse with mrz library
//   7. Map parsed fields → ExtractedFields

import { useCallback, useState } from "react";
import { parse as parseMRZ } from "mrz";
import type { ParseResult } from "mrz";

import {
  cropMRZRegion,
  detectDocumentType,
  extractMRZLines,
  normalizeMRZText,
  preprocessMRZCanvas,
} from "../lib/ocr";
import { dataUrlToImage } from "../utils/image";
import { initialFields } from "../lib/constants/kyc.constants";
import type { ExtractedFields } from "../types/kyc";
import type { KYCSession } from "../lib/services/session.service";
import { runOCR } from "../lib/services/ocr.service";
import { formatDate } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseOCRProps {
  documentImage: string;
  pushError:  (scope: string, message: string) => void;
  clearError: () => void;
  nextStep:   () => void;
}

interface UseOCRReturn {
  fields:        ExtractedFields;
  setFields:     React.Dispatch<React.SetStateAction<ExtractedFields>>;
  ocrProgress:   number;
  mrzValid:      boolean | null;
  mrzMessage:    string;
  busy:          boolean;
  runOCRAndMRZ:  () => Promise<void>;
  rehydrateOCR:  (s: Pick<KYCSession, "fields" | "mrzValid" | "mrzMessage">) => void;
  resetOCR:      () => void;
}

// ── MRZ line fixup ────────────────────────────────────────────────────────────
// Applied after extraction, before parsing.
// Only fixes structural issues (length, start character) — never replaces
// content characters like L or K, which are valid in names.

function fixMRZLine(line: string, index: number, targetLength: number): string {
  let l = line.replace(/[^A-Z0-9<]/g, "");

  // Passport line 1 must start with P — OCR sometimes reads it as 0P or OP
  if (index === 0 && targetLength === 44) {
    if (l.startsWith("0P") || l.startsWith("OP")) {
      l = "P<" + l.slice(2);
    }
    if (!l.startsWith("P")) {
      l = "P<" + l.slice(1);
    }
  }

  // Pad or truncate to exact target length
  if (l.length < targetLength) l = l.padEnd(targetLength, "<");
  if (l.length > targetLength) l = l.slice(0, targetLength);

  return l;
}

// ── OCR scoring ───────────────────────────────────────────────────────────────
// Counts characters that are valid in MRZ — used to pick the better of two
// Tesseract passes (raw vs preprocessed).

function scoreMRZText(text: string): number {
  return text.replace(/[^A-Z0-9<]/g, "").length;
}

// ── Field mapping ─────────────────────────────────────────────────────────────

function mapParsedFields(
  fields: ParseResult["fields"],
  rawMRZ: string,
  rawOCRText: string,
): ExtractedFields {
  const clean = (v: string | null | undefined) =>
    (v ?? "").replace(/</g, " ").trim();

  return {
    FirstName:         clean(fields.firstName as string),
    LastName:          clean(fields.lastName  as string),
    MiddleName:        "",   // MRZ does not carry a separate middle name field
    Email:             "",   // not in MRZ
    Address:           "",   // not in MRZ
    IdDocSerialNumber: (fields.documentNumber as string ?? "").replace(/</g, "").trim(),
    Nationality:       clean(fields.nationality as string),
    BirthDate:         fields.birthDate       ? formatDate(fields.birthDate as string)       : "",
    ExpiryDate:        fields.expirationDate  ? formatDate(fields.expirationDate as string)  : "",
    Gender:            ((fields.sex as string) ?? "").toUpperCase(),
    rawMRZ,
    rawOCRText,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOCR({
  documentImage,
  pushError,
  clearError,
  nextStep,
}: UseOCRProps): UseOCRReturn {
  const [fields,      setFields]      = useState<ExtractedFields>(initialFields);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [mrzValid,    setMrzValid]    = useState<boolean | null>(null);
  const [mrzMessage,  setMrzMessage]  = useState("");
  const [busy,        setBusy]        = useState(false);

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

      // ── Step 1: load image + detect document type ─────────────────────────
      const img     = await dataUrlToImage(documentImage);
      const docType = detectDocumentType(img);

      // ── Step 2: crop MRZ region ───────────────────────────────────────────
      const mrzCanvas = cropMRZRegion(img, docType);

      // ── Step 3: preprocess ────────────────────────────────────────────────
      const processedCanvas = await preprocessMRZCanvas(mrzCanvas);

      // ── Step 4: dual OCR pass ─────────────────────────────────────────────
      // Run both in parallel. Each pass reports progress independently;
      // we average them for the UI indicator.
      let progressA = 0;
      let progressB = 0;

      const updateProgress = () => {
        setOcrProgress(Math.round((progressA + progressB) / 2));
      };

      const [rawResult, processedResult] = await Promise.all([
        runOCR(mrzCanvas,       (p) => { progressA = p; updateProgress(); }),
        runOCR(processedCanvas, (p) => { progressB = p; updateProgress(); }),
      ]);

      const rawText       = rawResult.data.text       ?? "";
      const processedText = processedResult.data.text ?? "";

      // ── Step 5: pick better pass ──────────────────────────────────────────
      const bestText = scoreMRZText(processedText) >= scoreMRZText(rawText)
        ? processedText
        : rawText;

      // ── Step 6: normalise + extract lines ─────────────────────────────────
      const cleaned = normalizeMRZText(bestText);
      let lines     = extractMRZLines(cleaned);

      if (lines.length < 2) {
        // No MRZ found — document may be a licence or unreadable
        setFields((prev) => ({ ...prev, rawOCRText: cleaned }));
        setMrzValid(false);
        setMrzMessage(
          docType === "licence"
            ? "Driver licences may not contain a machine-readable zone. Please fill fields manually."
            : "No MRZ detected. Ensure the document is flat, well-lit, and the MRZ strip is visible.",
        );
        nextStep();
        return;
      }

      // ── Step 7: fix line structure ────────────────────────────────────────
      const targetLength = lines[0].length >= 40 ? 44 : 30;
      lines = lines
        .slice(0, targetLength === 44 ? 2 : 3)
        .map((line, i) => fixMRZLine(line, i, targetLength));

      const mrzSource = lines.join("\n");

      // ── Step 8: parse MRZ ─────────────────────────────────────────────────
      let parsed: ParseResult | null = null;
      let message = "MRZ detected but could not be parsed.";

      try {
        parsed  = parseMRZ(lines);
        message = parsed.valid
          ? "MRZ parsed successfully."
          : "MRZ format detected, but one or more check digits are invalid.";
      } catch {
        message = "MRZ lines found but are not in a recognised format.";
      }

      // ── Step 9: map fields ────────────────────────────────────────────────
      if (parsed?.fields) {
        setFields(mapParsedFields(parsed.fields, mrzSource, cleaned));
        setMrzValid(parsed.valid);
      } else {
        setFields((prev) => ({ ...prev, rawMRZ: mrzSource, rawOCRText: cleaned }));
        setMrzValid(false);
      }

      setMrzMessage(message);
      setOcrProgress(100);
      nextStep();
    } catch (err) {
      console.error("[useOCR] OCR pipeline error:", err);
      pushError("ocr", err instanceof Error ? err.message : "OCR failed unexpectedly.");
    } finally {
      setBusy(false);
    }
  }, [documentImage, clearError, pushError, nextStep]);

  // ── Rehydrate ─────────────────────────────────────────────────────────────
  const rehydrateOCR = useCallback(
    (s: Pick<KYCSession, "fields" | "mrzValid" | "mrzMessage">) => {
      if (s.fields)                setFields(s.fields);
      if (s.mrzValid !== undefined) setMrzValid(s.mrzValid);
      if (s.mrzMessage)            setMrzMessage(s.mrzMessage);
    },
    [],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
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
    rehydrateOCR,
    resetOCR,
  };
}