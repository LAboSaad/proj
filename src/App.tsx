
import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Tesseract from "tesseract.js";
import { parse as parseMRZ } from "mrz";
import "./index.css";
import type { AppError, DocumentQuality, ExtractedFields, FaceMatchResult, LandmarkStatus, LivenessChallenge, OcrRunResult, Step } from "./types/kyc";

import { analyzeDocumentQuality } from "./lib/quality";
import { cropMRZRegion, extractMRZLines, normalizeMRZText, preprocessMRZCanvas } from "./lib/ocr";
import Header from "./components/layout/Header";
import Stepper from "./components/layout/Stepper";
import ConsentStep from "./components/steps/ConsentStep";
import SelfieStep from "./components/steps/SelfieStep";
import DocumentStep from "./components/steps/DocumentStep";
import OCRStep from "./components/steps/OCRStep";
import FaceMatchStep from "./components/steps/FaceMatchStep";
import ReviewStep from "./components/steps/ReviewStep";
import { computeFaceQuality, computeYawFromLandmarks, getBestFaceDescriptor, getFaceMatchVerdict } from "./lib/services/face.service";
import { detectFaceWithRetry, waitForVideoReady } from "./lib/services/video.service";
import { buildPayload } from "./lib/services/payload.service";
import { docVideoConstraints, initialFields, steps, videoConstraints } from "./lib/constants/kyc.constants";
import { canvasToBlob, dataUrlToImage, fileToDataUrl, getCanvasFromImage } from "./utils/image";
import MSISDNStep from "./components/steps/MSISDNStep";
import { formatDateYYMMDD } from "./lib/utils";
import { detectPossibleSpoof } from "./lib/services/spoof.service";
import { useFaceLiveness } from "./hooks/useFaceLiveness";

/**
 * Production-style KYC Self Registration Frontend (TSX)
 * ----------------------------------------------------
 * Install:
 *   npm i react-webcam face-api.js tesseract.js mrz
 *
 * Required static assets:
 *   /public/models
 *     tiny_face_detector_model-weights_manifest.json (+ shards)
 *     face_landmark_68_model-weights_manifest.json (+ shards)
 *     face_recognition_model-weights_manifest.json (+ shards)
 *
 * Notes:
 * - Frontend only. It stops at the POST boundary.
 * - OCR/MRZ/face match are functional.
 * - Liveness is active challenge based and is not equivalent to commercial anti-spoofing.
 * - This version adds stronger typing, document quality checks, image pre-processing,
 *   payload shaping, better retry surfaces, and cleaner validation for backend handoff.
 */






export default function App(): JSX.Element {
  const selfieWebcamRef = useRef<Webcam | null>(null);
  const docWebcamRef = useRef<Webcam | null>(null);

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [agreed, setAgreed] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<AppError | null>(null);

  const [selfieImage, setSelfieImage] = useState<string>("");
  const [documentImage, setDocumentImage] = useState<string>("");
  const [documentPreviewMode, setDocumentPreviewMode] = useState<"camera" | "upload">("camera");
  const [documentQuality, setDocumentQuality] = useState<DocumentQuality | null>(null);
const [msisdn, setMsisdn] = useState("");
const [isEligible, setIsEligible] = useState<boolean | null>(null);

  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [fields, setFields] = useState<ExtractedFields>(initialFields);
  const [mrzValid, setMrzValid] = useState<boolean | null>(null);
  const [mrzMessage, setMrzMessage] = useState<string>("");
  const [faceMatch, setFaceMatch] = useState<FaceMatchResult | null>(null);

  const activeStep = steps[stepIndex];

    const {
  landmarkStatus,
  livenessCompleted,
  livenessChallenge,
  livenessDone,

} = useFaceLiveness({
  webcamRef: selfieWebcamRef,
  modelsLoaded,
  active: activeStep.key === "selfie",
});
 
  const payload = useMemo(
    () =>
      buildPayload({
        consentAccepted: agreed,
        selfieImage,
        documentImage,
        livenessDone,
        livenessCompleted,
        finalYawEstimate: landmarkStatus.yawEstimate,
        documentQuality,
        fields,
        mrzValid,
        mrzMessage,
        faceMatch,
      }),
    [
      agreed,
      selfieImage,
      documentImage,
    
      documentQuality,
      fields,
      mrzValid,
      mrzMessage,
      faceMatch,
    ]
  );


  const pushError = useCallback((scope: string, message: string): void => {
    setError({ scope, message });
  }, []);

  const clearError = useCallback((): void => setError(null), []);

  useEffect(() => {
    let mounted = true;

  async function loadModels(): Promise<void> {
  try {
    setBusy(true);

    await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    console.log("✅ tiny loaded");

    await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    console.log("✅ landmark loaded");

    await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    console.log("✅ recognition loaded");

    if (mounted) setModelsLoaded(true);
  } catch (err) {
    console.error("❌ FAILED MODEL:", err);

    if (mounted) {
      pushError(
        "models",
        `Model loading failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  } finally {
    if (mounted) setBusy(false);
  }
}

    void loadModels();

   
  }, [pushError]);


  const nextStep = useCallback((): void => {
    clearError();
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [clearError]);

  const prevStep = useCallback((): void => {
    clearError();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [clearError]);

const captureSelfie = useCallback(async (): Promise<void> => {
  try {
    clearError();

    if (!livenessDone) {
      pushError("liveness", "Complete liveness first.");
      return;
    }

    const dataUrl = selfieWebcamRef.current?.getScreenshot();
    if (!dataUrl) throw new Error("Selfie failed.");

    // 🔥 passive spoof check
    const spoof = await detectPossibleSpoof(dataUrl);
    if (spoof) {
      pushError("security", "Possible spoof (screen/photo). Try again.");
      return;
    }

    await getBestFaceDescriptor(await dataUrlToImage(dataUrl));
    setSelfieImage(dataUrl);
    nextStep();
  } catch (err) {
    pushError("selfie", "Selfie capture failed.");
  }
}, [livenessDone]);

const captureDocument = useCallback(async (): Promise<void> => {
  try {
    clearError();

    const screenshot = docWebcamRef.current;
    if (!screenshot) throw new Error("Webcam not ready");

    const dataUrl = screenshot.getScreenshot({
      width: 1920,
      height: 1080,
    });

    if (!dataUrl) throw new Error("Could not capture document image.");

    const quality = await analyzeDocumentQuality(dataUrl);

    const spoof = await detectPossibleSpoof(dataUrl);
    if (spoof) {
      pushError("security", "Possible screen/replay attack detected.");
      return;
    }

    setDocumentQuality(quality);
    setDocumentImage(dataUrl);

  } catch (err) {
    pushError("document", "Capture failed.");
  }
}, []);

  const handleDocumentUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      try {
        const file = event.target.files?.[0];
        if (!file) return;
        clearError();
        const dataUrl = await fileToDataUrl(file);
        const quality = await analyzeDocumentQuality(dataUrl);
        setDocumentImage(dataUrl);
        setDocumentQuality(quality);

        if (!quality.looksUsefulForOCR) {
          pushError(
            "document-quality",
            quality.reasons[0] || "Uploaded image quality is weak for OCR. You can still try, but results may be poor."
          );
        }
      } catch (err) {
        console.error(err);
        pushError("document", "Could not read uploaded document image.");
      }
    },
    [clearError, pushError]
  );

async function runOCR(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
) {
  return Tesseract.recognize(canvas, "eng", {
    logger: (info: any) => {
      if (info.status === "recognizing text" && onProgress) {
        onProgress(Math.round((info.progress || 0) * 100));
      }
    },
    // ⚠️ MUST be inside config
    config: {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    },
  } as any);
}

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

    console.log("🚀 ===== OCR START =====");

    // =========================================
    // STEP 1: LOAD IMAGE
    // =========================================
    const img = await dataUrlToImage(documentImage);

    // =========================================
    // STEP 2: CROP MRZ
    // =========================================
    const mrzCanvas = cropMRZRegion(img);
    console.log("📸 MRZ canvas:", mrzCanvas.width, mrzCanvas.height);

    // =========================================
    // STEP 3: PREPROCESS
    // =========================================
    const processedCanvas = await preprocessMRZCanvas(mrzCanvas);
    console.log("🧪 Preprocessing done");

    // =========================================
    // STEP 4: OCR (DUAL)
    // =========================================
    const [raw, processed] = await Promise.all([
      runOCR(mrzCanvas, setOcrProgress),
      runOCR(processedCanvas, setOcrProgress),
    ]);

    const rawText = raw.data.text || "";
    const processedText = processed.data.text || "";

    console.log("🔍 RAW OCR:\n", rawText);
    console.log("🔍 PROCESSED OCR:\n", processedText);

    // =========================================
    // STEP 5: PICK BEST OCR
    // =========================================
    const score = (t: string) =>
      t.replace(/[^A-Z0-9<]/g, "").length;

    const bestText =
      score(processedText) > score(rawText)
        ? processedText
        : rawText;

    console.log("🏆 BEST OCR:\n", bestText);

    // =========================================
    // STEP 6: NORMALIZE
    // =========================================
    const cleaned = normalizeMRZText(bestText);
    console.log("🧼 CLEANED:\n", cleaned);

    // =========================================
    // STEP 7: EXTRACT LINES
    // =========================================
    let lines = extractMRZLines(cleaned);
    console.log("📏 EXTRACTED LINES:", lines);

    let parsed: any = null;
    let mrzSource = "";
    let message = "No MRZ detected.";

    if (lines.length >= 2) {
      lines = lines.slice(0, 2);

      console.log("✂️ USING LINES:", lines);

      // =========================================
      // STEP 8: SAFE FIXING (NO OVER-REPAIR)
      // =========================================
      const fixedLines = lines.map((line, i) => {
        console.log(`🛠 ORIGINAL ${i}:`, line);

        let l = line;

        // 🔥 remove invalid chars ONLY
        l = l.replace(/[^A-Z0-9<]/g, "");

        // 🔥 fix VERY COMMON OCR errors (SAFE ONLY)
        l = l.replace(/^0P/, "P<");
        l = l.replace(/^OP/, "P<");

        // enforce 44 chars
        if (l.length < 44) l = l.padEnd(44, "<");
        if (l.length > 44) l = l.slice(0, 44);

        console.log(`✅ FINAL ${i}:`, l, "| len =", l.length);

        return l;
      });

      console.log("📦 FIXED LINES:", fixedLines);

      // =========================================
      // DEBUG COMPARISON
      // =========================================
      console.log("🆚 ===== COMPARISON =====");
      console.log("EXPECTED VALID:");
    
      console.log("OCR RESULT:");
      fixedLines.forEach((l, i) => console.log(`O${i}:`, l));

      // =========================================
      // STEP 9: PARSE (FIXED BUG HERE)
      // =========================================
      try {
        parsed = parseMRZ(fixedLines);

        console.log("🧠 OCR PARSED:", parsed);
        console.log("❗ OCR VALID:", parsed.valid);

        if (parsed.valid) {
          message = "MRZ parsed successfully.";
        } else {
          message =
            "MRZ format detected, but check digits invalid (sample or OCR noise).";
        }

        mrzSource = fixedLines.join("\n");
      } catch (err) {
        console.error("❌ MRZ PARSE ERROR:", err);
        message = "MRZ detected but unreadable.";
        mrzSource = fixedLines.join("\n");
      }
    }

    // =========================================
    // STEP 10: POPULATE FIELDS
    // =========================================
   // =========================================
// STEP 10: POPULATE FIELDS (FIXED)
// =========================================
if (parsed && parsed.fields) {
  const d = parsed.fields;

  console.log("📄 USING parsed.fields:", d);

  const mappedFields = {
    firstName: (d.firstName || "").replace(/</g, " ").trim(),
    lastName: (d.lastName || "").replace(/</g, " ").trim(),
    documentNumber: (d.documentNumber || "").replace(/</g, "").trim(),
    nationality: (d.nationality || "").trim(),
    birthDate: d.birthDate ? formatDateYYMMDD(d.birthDate) : "",
    expiryDate: d.expirationDate
      ? formatDateYYMMDD(d.expirationDate)
      : "",
    sex: (d.sex || "").toUpperCase(),

    rawMRZ: mrzSource,
    rawOCRText: cleaned,
  };

  console.log("✅ FINAL MAPPED FIELDS:", mappedFields);

  setFields(mappedFields);

  setMrzValid(parsed.valid);
  setMrzMessage(message);
} else {
  console.log("⚠️ NO parsed.fields");

  setFields((prev) => ({
    ...prev,
    rawMRZ: mrzSource,
    rawOCRText: cleaned,
  }));

  setMrzValid(false);
  setMrzMessage(message);
}

    console.log("🏁 ===== OCR END =====");

    nextStep();
  } catch (err) {
    console.error("❌ OCR ERROR:", err);
    pushError(
      "ocr",
      err instanceof Error ? err.message : "OCR failed."
    );
  } finally {
    setBusy(false);
  }
}, [documentImage, clearError, pushError, nextStep]);

  const runFaceMatch = useCallback(async (): Promise<void> => {
    if (!selfieImage || !documentImage) {
      pushError("face-match", "Selfie and document image are required.");
      return;
    }

    try {
      clearError();
      setBusy(true);

      const selfie = await dataUrlToImage(selfieImage);
      const documentImg = await dataUrlToImage(documentImage);

      const selfieDetection = await getBestFaceDescriptor(selfie);
      const docDetection = await getBestFaceDescriptor(documentImg);

      const matcher = new faceapi.FaceMatcher([
        new faceapi.LabeledFaceDescriptors("selfie", [selfieDetection.descriptor]),
      ]);

      const result = matcher.findBestMatch(docDetection.descriptor);
      const verdict = getFaceMatchVerdict(result.distance);
      setFaceMatch(verdict);
      nextStep();
    } catch (err) {
      console.error(err);
      pushError(
        "face-match",
        err instanceof Error
          ? `${err.message} Ensure both the selfie and the document image contain one clear face.`
          : "Face match failed."
      );
    } finally {
      setBusy(false);
    }
  }, [clearError, documentImage, nextStep, pushError, selfieImage]);

  const exportPayloadFile = useCallback(async (): Promise<void> => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kyc-payload-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [payload]);

  const saveDocumentBlobLocally = useCallback(async (): Promise<void> => {
    if (!documentImage) return;
    const image = await dataUrlToImage(documentImage);
    const canvas = getCanvasFromImage(image);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `document-capture-${Date.now()}.jpg`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [documentImage]);

  const resetFlow = useCallback((): void => {
    clearError();
    setStepIndex(0);
    setAgreed(false);
    setSelfieImage("");
    setDocumentImage("");
    setDocumentQuality(null);
    setOcrProgress(0);
    setFields(initialFields);
    setMrzValid(null);
    setMrzMessage("");
    setFaceMatch(null);
  }, [clearError]);

  const submitToBackendBoundary = useCallback(async (): Promise<void> => {
    // Replace with your backend contract later.
    // Example:
    // await fetch("/api/kyc/register", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });
    alert("Payload is ready. Replace this boundary with your backend POST.");
  }, [payload]);

  return (
    <div className="min-h-screen bg-[#a11775] flex justify-center  text-slate-100">
      <div className="mx-auto  max-w-7xl flex flex-col justify-center sm:py-10 py-3">
       <Header modelsLoaded={modelsLoaded} activeStepLabel={activeStep.label} />

      <Stepper steps={steps} stepIndex={stepIndex} />

        {error && (
          <div className="mb-6 rounded-2xl border border-[#ee7d00] bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <strong className="mr-2 uppercase tracking-wide">{error.scope}</strong>
            {error.message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] w-full">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
           {activeStep.key === "msisdn" && (
        <MSISDNStep
          msisdn={msisdn}
          setMsisdn={setMsisdn}
          setIsEligible={setIsEligible}
          nextStep={nextStep}
          isEligible={isEligible}
        />
      )}
            {activeStep.key === "consent" && (
             <ConsentStep
                agreed={agreed}
                setAgreed={setAgreed}
                nextStep={nextStep}
                modelsLoaded={modelsLoaded}
              />
            )}

            {activeStep.key === "selfie" && (
             <SelfieStep
                selfieWebcamRef={selfieWebcamRef}
                videoConstraints={videoConstraints}
                landmarkStatus={landmarkStatus}
                livenessCompleted={livenessCompleted}
                livenessDone={livenessDone}
                captureSelfie={captureSelfie}
                prevStep={prevStep}
                selfieImage={selfieImage}
                livenessChallenge={livenessChallenge}
              />

            )}
            {activeStep.key === "document" && (
            <DocumentStep
              documentPreviewMode={documentPreviewMode}
              setDocumentPreviewMode={setDocumentPreviewMode}
              docWebcamRef={docWebcamRef}
              captureDocument={captureDocument}
              handleDocumentUpload={handleDocumentUpload}
              documentImage={documentImage}
              runOCRAndMRZ={runOCRAndMRZ}
             prevStep={prevStep}
    docVideoConstraints={docVideoConstraints}  
    documentQuality={documentQuality}          
    saveDocumentBlobLocally={saveDocumentBlobLocally}
    busy={busy} 
            />
            )}

            {activeStep.key === "ocr" && (
          <OCRStep
  fields={fields}
  setFields={setFields}
  runFaceMatch={runFaceMatch}
  prevStep={prevStep}
  mrzValid={mrzValid}
  mrzMessage={mrzMessage}
  busy={busy}
/>
            )}

            {activeStep.key === "match" && (
            <FaceMatchStep
  selfieImage={selfieImage}
  documentImage={documentImage}
  faceMatch={faceMatch}
  prevStep={prevStep}
  nextStep={nextStep}
/>
            )}

           {activeStep.key === "review" && (
  <ReviewStep
    payload={payload}
    prevStep={prevStep}
    exportPayloadFile={exportPayloadFile}
    submitToBackendBoundary={submitToBackendBoundary}
    resetFlow={resetFlow}
  />
)}
          </div>

       {/* <Sidebar
  busy={busy}
  ocrProgress={ocrProgress}
  documentQuality={documentQuality}
  payload={payload}
/> */}
        </div>
      </div>
    </div>
  );
}

