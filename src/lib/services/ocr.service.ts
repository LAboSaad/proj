// src/lib/services/ocr.service.ts
//
// Thin wrapper around Tesseract.js configured for MRZ recognition.
//
// Key settings:
//   • Whitelist: only characters valid in MRZ (A-Z, 0-9, <)
//   • PSM 6 (uniform block): best for the full cropped MRZ region
//   • PSM 7 (single line): used when processing individual lines
//   • OEM 1 (LSTM only): more accurate than legacy+LSTM combined for MRZ
//   • Disabled dictionary lookups: MRZ is not natural language

import Tesseract from "tesseract.js";

const MRZ_WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";

// Shared Tesseract parameters for all MRZ recognition passes
const BASE_PARAMS = {
  tessedit_char_whitelist:    MRZ_WHITELIST,
  tessedit_ocr_engine_mode:   "1",    // LSTM only — more accurate for MRZ
  load_system_dawg:           "0",    // disable dictionary — MRZ is not a word
  load_freq_dawg:             "0",    // disable frequency dictionary
  preserve_interword_spaces:  "0",    // MRZ has no spaces
};

/**
 * Runs Tesseract OCR on a canvas element.
 *
 * @param canvas    - The preprocessed MRZ canvas
 * @param onProgress - Optional callback receiving 0–100 progress
 * @param singleLine - If true, uses PSM 7 (single text line) instead of PSM 6
 */
export async function runOCR(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void,
  singleLine = false,
): Promise<Tesseract.RecognizeResult> {
  return Tesseract.recognize(canvas, "eng", {
    logger: (info: Tesseract.LoggerMessage) => {
      if (info.status === "recognizing text" && onProgress) {
        onProgress(Math.round((info.progress ?? 0) * 100));
      }
    },
    ...({
      tessedit_pageseg_mode: singleLine ? "7" : "6",
      ...BASE_PARAMS,
    } as Record<string, string>),
  });
}