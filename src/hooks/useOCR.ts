import { useCallback, useState } from "react";

import { initialFields } from "../lib/constants/kyc.constants";
import type { ExtractedFields } from "../types/kyc";
import type { KYCSession } from "../lib/services/session.service";
import { formatDate } from "../lib/utils";

// ── Config ────────────────────────────────────────────────────────────────────

const OCR_API_URL = "/api/ocr/passport";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  rehydrateOCR: (
    s: Pick<KYCSession, "fields" | "mrzValid" | "mrzMessage">,
  ) => void;
  resetOCR: () => void;
}

// ── API response shape ────────────────────────────────────────────────────────

interface OCRApiResponse {
  success: boolean;
  confidence: string; // e.g. "VALID" | "INVALID" | "LOW"
  mrz_lines: string[];
  parsed_data: {
    document_type: string;
    issuing_country: string;
    surname: string;
    given_names: string; // may contain middle name separated by space
    document_number: string;
    nationality: string;
    birth_date: string; // YYMMDD
    sex: string;
    expiry_date: string; // YYMMDD
    optional_data: string;
    mrz_type: string;
  };
  validation: {
    doc_number_ok: boolean;
    birth_date_ok: boolean;
    expiry_date_ok: boolean;
    optional_data_ok: boolean;
    composite_ok: boolean;
    line_lengths_ok: boolean;
    line_count_ok: boolean;
    valid_check_digits: number;
    errors: string[];
  };
  engine: string;
  variant: string;
  score: number;
  tiers_attempted: number;
  processing_time_ms: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert a data URL to a File so it can be sent as multipart form data. */
function dataUrlToFile(dataUrl: string, filename = "document.jpg"): File {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Determine overall MRZ validity from the API validation block. */
function isApiResponseValid(res: OCRApiResponse): boolean {
  return (
    res.success &&
    res.validation.doc_number_ok &&
    res.validation.birth_date_ok &&
    res.validation.expiry_date_ok &&
    res.validation.composite_ok &&
    res.validation.line_lengths_ok &&
    res.validation.line_count_ok &&
    res.validation.errors.length === 0
  );
}

/** Map API parsed_data → ExtractedFields. */
function mapApiFields(
  res: OCRApiResponse,
  rawOCRText: string,
): ExtractedFields {
  const { parsed_data } = res;

  // given_names may be "IBRAHIM TUARIC" — split on first space into first + middle
  const nameParts = (parsed_data.given_names ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const middleName = nameParts.slice(1).join(" ");

  return {
    FirstName: firstName,
    LastName: parsed_data.surname ?? "",
    MiddleName: middleName,
    Email: "", // not in MRZ
    Address: "", // not in MRZ
    IdDocSerialNumber: parsed_data.document_number ?? "",
    Nationality: parsed_data.nationality ?? "",
    BirthDate: parsed_data.birth_date ? formatDate(parsed_data.birth_date) : "",
    ExpiryDate: parsed_data.expiry_date
      ? formatDate(parsed_data.expiry_date)
      : "",
    Gender: (parsed_data.sex ?? "").toUpperCase(),
    rawMRZ: res.mrz_lines.join("\n"),
    rawOCRText,
  };
}

/** Build a human-readable status message from the API response. */
function buildMrzMessage(res: OCRApiResponse): string {
  if (!res.success) return "OCR API failed to process the document.";

  const errors = res.validation.errors;
  if (errors.length > 0) {
    return `MRZ format detected, but validation failed: ${errors.join("; ")}.`;
  }

  if (isApiResponseValid(res)) return "MRZ parsed successfully.";

  return "MRZ detected but one or more check digits are invalid.";
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOCR({
  documentImage,
  pushError,
  clearError,
  nextStep,
}: UseOCRProps): UseOCRReturn {
  const [fields, setFields] = useState<ExtractedFields>(initialFields);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [mrzValid, setMrzValid] = useState<boolean | null>(null);
  const [mrzMessage, setMrzMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

      // ── Step 1: convert data URL → File ───────────────────────────────────
      const file = dataUrlToFile(documentImage);
      setOcrProgress(20);

      // ── Step 2: build multipart form and POST to OCR API ──────────────────
      const form = new FormData();
      form.append("file", file);

      setOcrProgress(40);

      const response = await fetch(OCR_API_URL, {
        method: "POST",
        body: form,
      });

      setOcrProgress(80);

      if (!response.ok) {
        throw new Error(
          `OCR API returned ${response.status}: ${response.statusText}`,
        );
      }

      const res: OCRApiResponse = await response.json();

      // ── Step 3: handle API-level failure ──────────────────────────────────
      if (!res.success) {
        setFields((prev) => ({
          ...prev,
          rawOCRText: res.mrz_lines?.join("\n") ?? "",
        }));
        setMrzValid(false);
        setMrzMessage(
          "OCR API could not read the document. Ensure it is flat, well-lit, and the MRZ strip is visible.",
        );
        nextStep();
        return;
      }

      // ── Step 4: no MRZ lines returned ─────────────────────────────────────
      if (!res.mrz_lines || res.mrz_lines.length < 2) {
        setFields((prev) => ({ ...prev, rawOCRText: "" }));
        setMrzValid(false);
        setMrzMessage(
          "No MRZ detected. Ensure the document is flat, well-lit, and the MRZ strip is visible.",
        );
        nextStep();
        return;
      }

      // ── Step 5: map fields + set state ────────────────────────────────────
      const rawOCRText = res.mrz_lines.join("\n");
      const valid = isApiResponseValid(res);
      const message = buildMrzMessage(res);

      setFields(mapApiFields(res, rawOCRText));
      setMrzValid(valid);
      setMrzMessage(message);
      setOcrProgress(100);
      nextStep();
    } catch (err) {
      console.error("[useOCR] OCR pipeline error:", err);
      pushError(
        "ocr",
        err instanceof Error ? err.message : "OCR failed unexpectedly.",
      );
    } finally {
      setBusy(false);
    }
  }, [documentImage, clearError, pushError, nextStep]);

  // ── Rehydrate ─────────────────────────────────────────────────────────────
  const rehydrateOCR = useCallback(
    (s: Pick<KYCSession, "fields" | "mrzValid" | "mrzMessage">) => {
      if (s.fields) setFields(s.fields);
      if (s.mrzValid !== undefined) setMrzValid(s.mrzValid);
      if (s.mrzMessage) setMrzMessage(s.mrzMessage);
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
