// src/hooks/useOCR.ts
import { useCallback, useState } from "react";

import { parse as parseMRZ } from "mrz";
import { cropMRZRegion, extractMRZLines, normalizeMRZText, preprocessMRZCanvas } from "../lib/ocr";
import { dataUrlToImage } from "../utils/image";
import { formatDateYYMMDD } from "../lib/utils";
import { initialFields } from "../lib/constants/kyc.constants";
import type { ExtractedFields } from "../types/kyc";
import { runOCR } from "../lib/services/ocr.service";

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

// const runOCRAndMRZ = useCallback(async (): Promise<void> => {
//   if (!documentImage) {
//     pushError("ocr", "Capture or upload a document image first.");
//     return;
//   }

//   // 🔥 TOGGLE FOR DEBUGGING
//   const USE_STATIC_MRZ = true;

//   // ✅ Known valid MRZ sample
//   const STATIC_MRZ = [
//     "P<LBNABO<SAAD<<LAYLA<<<<<<<<<<<<<<<<<<<<<<<<",
//     "LR30027611LBN0001018F33011991001865844<<<<50",
//   ];

//   try {
//     console.log("🚀 ===== OCR START =====");

//     clearError();
//     setBusy(true);
//     setOcrProgress(0);
//     setMrzValid(null);
//     setMrzMessage("");

//     let lines: string[] = [];
//     let cleaned = "";

//     // ─────────────────────────────────────────────
//     // 🔹 STATIC MODE (BYPASS OCR COMPLETELY)
//     // ─────────────────────────────────────────────
//     if (USE_STATIC_MRZ) {
//       console.log("🧪 USING STATIC MRZ (BYPASS OCR)");

//       lines = STATIC_MRZ;
//       cleaned = STATIC_MRZ.join("\n");

//       console.log("📑 STATIC LINES:", lines);
//     } else {
//       // ── Step 1: load image ───────────────────────
//       console.log("📸 Step 1: Loading image...");
//       const img = await dataUrlToImage(documentImage);
//       console.log("✅ Image loaded:", {
//         width: img.width,
//         height: img.height,
//       });

//       // ── Step 2: crop MRZ ─────────────────────────
//       console.log("✂️ Step 2: Cropping MRZ...");
//       const mrzCanvas = cropMRZRegion(img);

//       console.log("📐 MRZ Canvas:", {
//         width: mrzCanvas.width,
//         height: mrzCanvas.height,
//       });

//       const mrzBase64 = mrzCanvas.toDataURL("image/png");
//       console.log("🖼️ MRZ BASE64:", mrzBase64);

//       const img1 = document.createElement("img");
//       img1.src = mrzBase64;
//       img1.style.border = "2px solid red";
//       img1.style.maxWidth = "400px";
//       document.body.appendChild(img1);

//       // ── Step 3: preprocess ───────────────────────
//       console.log("🧪 Step 3: Preprocessing...");
//       const processedCanvas = await preprocessMRZCanvas(mrzCanvas);

//       const processedBase64 = processedCanvas.toDataURL("image/png");
//       console.log("🖼️ PROCESSED BASE64:", processedBase64);

//       const img2 = document.createElement("img");
//       img2.src = processedBase64;
//       img2.style.border = "2px solid green";
//       img2.style.maxWidth = "400px";
//       document.body.appendChild(img2);

//       // ── Step 4: OCR ──────────────────────────────
//       console.log("🔍 Step 4: Running OCR (dual pass)...");
//       const [raw, processed] = await Promise.all([
//         runOCR(mrzCanvas, setOcrProgress),
//         runOCR(processedCanvas, setOcrProgress),
//       ]);

//       const rawText = raw.data.text || "";
//       const processedText = processed.data.text || "";

//       console.log("📄 RAW OCR:", rawText);
//       console.log("📄 PROCESSED OCR:", processedText);

//       // ── Step 5: scoring ──────────────────────────
//       const score = (t: string) =>
//         t.replace(/[^A-Z0-9<]/g, "").length;

//       const bestText =
//         score(processedText) > score(rawText)
//           ? processedText
//           : rawText;

//       console.log("🏆 BEST OCR SELECTED:", bestText);

//       // ── Step 6: normalize ────────────────────────
//       cleaned = normalizeMRZText(bestText);

//       console.log("🧾 CLEANED OCR:", cleaned);

//       // ── Step 7: extract lines ────────────────────
//       lines = extractMRZLines(cleaned);

//       console.log("📑 EXTRACTED LINES:", lines);
//       console.log(
//         "📏 LINE LENGTHS:",
//         lines.map((l) => l.length)
//       );
//     }

//     // ─────────────────────────────────────────────
//     // 🔹 PARSING (COMMON PATH)
//     // ─────────────────────────────────────────────
//     let parsed: any = null;
//     let mrzSource = "";
//     let message = "No MRZ detected.";

//     if (lines.length >= 2) {
//       lines = lines.slice(0, 2);

//       console.log("✂️ USING FIRST 2 LINES:", lines);

//       // 🔥 DO NOT MODIFY STATIC MRZ
//       const fixedLines = USE_STATIC_MRZ
//         ? lines
//         : lines.map((line, idx) => {
//             let l = line;

//             console.log(`🔧 BEFORE FIX [${idx}]:`, l);

//             l = l.replace(/[^A-Z0-9<]/g, "");

//             // ⚠️ safer than your previous logic (minimal correction)
//             if (l.startsWith("0P") || l.startsWith("OP")) {
//               l = "P<" + l.slice(2);
//             }

//             if (l.length < 44) l = l.padEnd(44, "<");
//             if (l.length > 44) l = l.slice(0, 44);

//             console.log(`🔧 AFTER FIX [${idx}]:`, l);

//             return l;
//           });

//       console.log("🧠 FINAL FIXED LINES:", fixedLines);

//       // ── Step 9: parse ───────────────────────────
//       try {
//         parsed = parseMRZ(fixedLines);

//         console.log("🧠 PARSED RESULT:", parsed);

//         message = parsed.valid
//           ? "MRZ parsed successfully."
//           : "MRZ format detected, but check digits invalid.";

//         mrzSource = fixedLines.join("\n");
//       } catch (e) {
//         console.log("❌ PARSE ERROR:", e);

//         message = "MRZ detected but unreadable.";
//         mrzSource = fixedLines.join("\n");
//       }
//     }

//     // ─────────────────────────────────────────────
//     // 🔹 FINAL OUTPUT
//     // ─────────────────────────────────────────────
//     if (parsed?.fields) {
//       const d = parsed.fields;

//       console.log("📦 FINAL FIELDS:", d);

//       setFields({
//         firstName: (d.firstName || "").replace(/</g, " ").trim(),
//         lastName: (d.lastName || "").replace(/</g, " ").trim(),
//         documentNumber: (d.documentNumber || "").replace(/</g, "").trim(),
//         nationality: (d.nationality || "").trim(),
//         birthDate: d.birthDate ? formatDateYYMMDD(d.birthDate) : "",
//         expiryDate: d.expirationDate
//           ? formatDateYYMMDD(d.expirationDate)
//           : "",
//         sex: (d.sex || "").toUpperCase(),
//         rawMRZ: mrzSource,
//         rawOCRText: cleaned,
//       });

//       setMrzValid(parsed.valid);
//       setMrzMessage(message);
//     } else {
//       console.log("⚠️ NO PARSED FIELDS");

//       setFields((prev) => ({
//         ...prev,
//         rawMRZ: mrzSource,
//         rawOCRText: cleaned,
//       }));

//       setMrzValid(false);
//       setMrzMessage(message);
//     }

//     console.log("🏁 ===== OCR END =====");

//     nextStep();
//   } catch (err) {
//     console.error("💥 OCR ERROR:", err);

//     pushError(
//       "ocr",
//       err instanceof Error ? err.message : "OCR failed."
//     );
//   } finally {
//     setBusy(false);
//   }
// }, [documentImage, clearError, pushError, nextStep]);

//   const resetOCR = useCallback(() => {
//     setFields(initialFields);
//     setOcrProgress(0);
//     setMrzValid(null);
//     setMrzMessage("");
//   }, []);

//   return {
//     fields,
//     setFields,
//     ocrProgress,
//     mrzValid,
//     mrzMessage,
//     busy,
//     runOCRAndMRZ,
//     resetOCR,
//   };
// }
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

    // ── Step 1: load image ──────────────────────────
    const img = await dataUrlToImage(documentImage);

    // ── Step 2: crop MRZ region ─────────────────────
    const mrzCanvas = cropMRZRegion(img);

    // ── Step 3: preprocess ──────────────────────────
    const processedCanvas = await preprocessMRZCanvas(mrzCanvas);

    console.log("🖼️ RAW MRZ:", mrzCanvas.toDataURL("image/png"));
    console.log("🖼️ PROCESSED MRZ:", processedCanvas.toDataURL("image/png"));

    // ── Step 4: dual OCR ────────────────────────────
    const [raw, processed] = await Promise.all([
      runOCR(mrzCanvas, setOcrProgress),
      runOCR(processedCanvas, setOcrProgress),
    ]);
console.log("raw", raw)
console.log("processed", processed)
    const rawText = raw.data.text || "";
    const processedText = processed.data.text || "";

    // ── Step 5: pick best (NO normalization) ────────
    const score = (t: string) => t.replace(/[^A-Z0-9<]/g, "").length;
    const bestText =
      score(processedText) > score(rawText) ? processedText : rawText;

    // ✅ KEEP THIS EXACT (for display)
    const rawMRZText = bestText;

    // ── Step 6: minimal structural prep ONLY ────────
    // ❗ NOT fixing characters, ONLY making it parsable
    let lines = bestText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let parsed: any = null;
    let message = "No MRZ detected.";
    let mrzSource = rawMRZText;

    if (lines.length >= 2) {
      lines = lines.slice(0, 2);

      const parseReadyLines = lines.map((line) => {
        let l = line
          .toUpperCase()
          .replace(/[^A-Z0-9<]/g, ""); // remove noise only

        // ONLY enforce length (NOT content correction)
        if (l.length < 44) l = l.padEnd(44, "<");
        if (l.length > 44) l = l.slice(0, 44);

        return l;
      });

      try {
        parsed = parseMRZ(parseReadyLines);
        message = parsed.valid
          ? "MRZ parsed successfully."
          : "MRZ format detected, check digits may be invalid.";

        mrzSource = parseReadyLines.join("\n");
      } catch {
        message = "MRZ detected but unreadable.";
      }
    }

    // ── Step 7: populate fields ─────────────────────
    if (parsed?.fields) {
      const d = parsed.fields;

      setFields({
        firstName: (d.firstName || "").replace(/</g, " ").trim(),
        lastName: (d.lastName || "").replace(/</g, " ").trim(),
        documentNumber: (d.documentNumber || "").replace(/</g, "").trim(),
        nationality: d.nationality || "",
        birthDate: d.birthDate
          ? formatDateYYMMDD(d.birthDate)
          : "",
        expiryDate: d.expirationDate
          ? formatDateYYMMDD(d.expirationDate)
          : "",
        sex: (d.sex || "").toUpperCase(),

        // 🔥 KEY PART
        rawMRZ: rawMRZText,   // 👈 EXACT OCR (UNCHANGED)
        rawOCRText: rawMRZText,
      });

      setMrzValid(parsed.valid);
      setMrzMessage(message);
    } else {
      setFields((prev) => ({
        ...prev,
        rawMRZ: rawMRZText,
        rawOCRText: rawMRZText,
      }));

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