// src/App.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Only the liveness and selfie sections changed. Everything else stays identical.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from "react";
import type { JSX } from "react";
import Webcam from "react-webcam";

import { useKYCFlow }      from "./hooks/useKYCFlow";
import { useModels }       from "./hooks/useModels";
import { useSelfie }       from "./hooks/useSelfie";
import { useDocument }     from "./hooks/useDocument";
import { useOCR }          from "./hooks/useOCR";
import { useFaceMatch }    from "./hooks/useFaceMatch";
import { useFaceLiveness } from "./hooks/useFaceLiveness";

import { buildPayload }    from "./lib/services/payload.service";
import { videoConstraints, docVideoConstraints, steps } from "./lib/constants/kyc.constants";

import Header        from "./components/layout/Header";
import Stepper       from "./components/layout/Stepper";
import MSISDNStep    from "./components/steps/MSISDNStep";
import ConsentStep   from "./components/steps/ConsentStep";
import SelfieStep    from "./components/steps/SelfieStep";
import DocumentStep  from "./components/steps/DocumentStep";
import OCRStep       from "./components/steps/OCRStep";
import FaceMatchStep from "./components/steps/FaceMatchStep";
import ReviewStep    from "./components/steps/ReviewStep";

import { useState, useMemo } from "react";
import { LanguageSwitcher } from "./components/layout/LanguageSwitcher";

export default function App(): JSX.Element {
  const selfieWebcamRef = useRef<Webcam | null>(null);
  const docWebcamRef    = useRef<Webcam | null>(null);

  // ── flow & error ──────────────────────────────────────────────────
  const {
    stepIndex,
    activeStep,
    error,
    agreed,
    setAgreed,
    nextStep,
    prevStep,
    pushError,
    clearError,
    resetFlow,
  } = useKYCFlow();

  // ── model loading ─────────────────────────────────────────────────
  const { modelsLoaded } = useModels(pushError);

  // ── liveness ──────────────────────────────────────────────────────
  const {
    phase,                // ← NEW
    landmarkStatus,
    livenessCompleted,
    livenessChallenge,
    livenessDone,
    challengeSequence,
    challengeIndex,
    challengeTimeLeft,    // ← NEW
    startChallenges,      // ← NEW
    resetLiveness,
  } = useFaceLiveness({
    webcamRef: selfieWebcamRef,
    modelsLoaded,
    active: activeStep.key === "selfie",
    challengeCount: 3,
  });

  // ── selfie ────────────────────────────────────────────────────────
  const {
    selfieImage,
    captureSelfie,
    resetSelfie,
  } = useSelfie({
    webcamRef: selfieWebcamRef,
    livenessDone,
    pushError,
    clearError,
    nextStep,
  });

  // ── document ──────────────────────────────────────────────────────
  const {
    documentImage,
    documentQuality,
    documentPreviewMode,
    setDocumentPreviewMode,
    captureDocument,
    handleDocumentUpload,
    saveDocumentBlobLocally,
    resetDocument,
  } = useDocument({ docWebcamRef, pushError, clearError });

  // ── OCR & MRZ ─────────────────────────────────────────────────────
  const {
    fields,
    setFields,
    mrzValid,
    mrzMessage,
    busy: ocrBusy,
    runOCRAndMRZ,
    resetOCR,
  } = useOCR({ documentImage, pushError, clearError, nextStep });

  // ── face match ────────────────────────────────────────────────────
  const {
    faceMatch,
    busy: matchBusy,
    runFaceMatch,
    resetFaceMatch,
  } = useFaceMatch({ selfieImage, documentImage, pushError, clearError, nextStep });

  // ── MSISDN ────────────────────────────────────────────────────────
  const [msisdn, setMsisdn]         = useState("");
  const [isEligible, setIsEligible] = useState<boolean | null>(null);

  // ── payload ───────────────────────────────────────────────────────
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
    [agreed, selfieImage, documentImage, livenessDone, livenessCompleted,
     landmarkStatus.yawEstimate, documentQuality, fields, mrzValid, mrzMessage, faceMatch]
  );

  // ── reset all ─────────────────────────────────────────────────────
  const handleReset = () =>
    resetFlow(() => {
      resetSelfie();
      resetDocument();
      resetOCR();
      resetFaceMatch();
      resetLiveness();
      setMsisdn("");
      setIsEligible(null);
    });

  // ── export payload ────────────────────────────────────────────────
  const exportPayloadFile = () => {
    const blob   = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url    = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href     = url;
    anchor.download = `kyc-payload-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submitToBackendBoundary = async () => {
    alert("Payload ready. Replace this with your backend POST.");
  };

  // ── render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-20 bg-[#a11775] flex justify-center flex-col text-slate-100">
      <LanguageSwitcher/>
      <div className="mx-auto max-w-7xl flex flex-col justify-center sm:py-10 py-3">
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

            {/* ── SELFIE STEP — updated props ── */}
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
                challengeSequence={challengeSequence}
                challengeIndex={challengeIndex}
                challengeTimeLeft={challengeTimeLeft}   // ← NEW
                phase={phase}                           // ← NEW
                startChallenges={startChallenges}       // ← NEW
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
                busy={ocrBusy}
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
                busy={matchBusy}
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
                resetFlow={handleReset}
              />
            )}

          </div>
        </div>
      </div>
    </div>
  );
}