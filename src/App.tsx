import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import Tesseract from "tesseract.js";
import { parse as parseMRZ } from "mrz";
import "./index.css";
import type { AppError, DocumentQuality, ExtractedFields, FaceMatchResult, LandmarkStatus, LivenessChallenge, OcrRunResult, Step } from "./types/kyc";

import { analyzeDocumentQuality } from "./lib/quality";
import { cropMRZRegion, extractMRZLines, normalizeMRZ, normalizeMRZText, preprocessMRZCanvas, repairMRZLine } from "./lib/ocr";
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
import { runMRZOCR, runOCR } from "./lib/services/ocr.service";
import { extractFieldsWithAI } from "./lib/services/ai-extraction.service";
import { normalizeMRZLines, parseMRZFromSource } from "./lib/services/mrz.service";
import { mapMRZFields } from "./lib/services/field.mapper";


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
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
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




const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  if (!mimeMatch) throw new Error("Invalid data URL");

  const mime = mimeMatch[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
};


const runOCRAndMRZ = useCallback(async (): Promise<void> => {
  if (!documentImage) {
    pushError("ocr", "Capture document first.");
    return;
  }

  try {
    clearError();
    setBusy(true);
    setOcrProgress(0);

    // 🔹 OCR
    const { cleaned, lines } = await runMRZOCR(
      documentImage,
      setOcrProgress
    );

    // 🔹 AI
    const blob = await fetch(documentImage).then((r) => r.blob());
    const aiFields = await extractFieldsWithAI(
      blob,
      OPENAI_API_KEY
    );

    let parsed: any = null;
    let mrzSource = "";
    let message = "No MRZ detected";

    // 🔥 AI FIRST
    if (aiFields?.mrzLines?.length === 2) {
      const aiMRZ = normalizeMRZLines(aiFields.mrzLines);
console.log("aiFields.mrzLines", aiFields.mrzLines)
console.log("aiMRZ", aiMRZ)
      const res = parseMRZFromSource(aiMRZ);
console.log("checking res in ai", res)
      parsed = res.parsed;
      mrzSource = aiMRZ.join("\n");

      message = res.valid
        ? "MRZ valid (AI)"
        : "AI MRZ invalid";
    }

    // 🔥 OCR FALLBACK
    if (!parsed && lines.length >= 2) {
      const fixed = normalizeMRZLines(lines.slice(0, 2));
      console.log("checking fixed",fixed)
      const res = parseMRZFromSource(fixed);

      parsed = res.parsed;
      mrzSource = fixed.join("\n");

      message = res.valid
        ? "MRZ valid (OCR)"
        : "OCR MRZ invalid";
    }

    const mrzFields = mapMRZFields(parsed);

    const useMRZ = parsed?.valid;

    const finalFields = {
      firstName: useMRZ ? mrzFields?.firstName : aiFields.firstName,
      lastName: useMRZ ? mrzFields?.lastName : aiFields.lastName,
      documentNumber: useMRZ
        ? mrzFields?.documentNumber
        : aiFields.documentNumber,
      nationality: useMRZ
        ? mrzFields?.nationality
        : aiFields.nationality,
      birthDate: useMRZ
        ? mrzFields?.birthDate
        : aiFields.birthDate,
      expiryDate: useMRZ
        ? mrzFields?.expiryDate
        : aiFields.expiryDate,
      sex: useMRZ ? mrzFields?.sex : aiFields.sex,
      rawMRZ: mrzSource,
      rawOCRText: cleaned,
    };

    setFields(finalFields);
    setMrzValid(parsed?.valid ?? false);
    setMrzMessage(message);

    nextStep();
  } catch (err) {
    pushError("ocr", "OCR failed");
  } finally {
    setBusy(false);
  }
}, [documentImage]);

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
