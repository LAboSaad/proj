// src/App.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Webcam from "react-webcam";

import { useKYCFlow } from "./hooks/useKYCFlow";
import { useModels } from "./hooks/useModels";
import { useSessionTimers } from "./hooks/useSessionTimers";
import { useSelfie } from "./hooks/useSelfie";
import { useDocument } from "./hooks/useDocument";
import { useOCR } from "./hooks/useOCR";
import { useFaceMatch } from "./hooks/useFaceMatch";
import { useFaceLiveness } from "./hooks/useFaceLiveness";

import { buildPayload } from "./lib/services/payload.service";
import {
  loadSession,
  saveSession,
  startExpiryWatcher,
} from "./lib/services/session.service";
import {
  videoConstraints,
  docVideoConstraints,
  steps,
} from "./lib/constants/kyc.constants";

import Header from "./components/layout/Header";
import Stepper from "./components/layout/Stepper";
import MSISDNStep from "./components/steps/MSISDNStep";
import ConsentStep from "./components/steps/ConsentStep";
import SelfieStep from "./components/steps/selfieStep/SelfieStep";
import OCRStep from "./components/steps/OCRStep";
import FaceMatchStep from "./components/steps/FaceMatchStep";
import ReviewStep from "./components/steps/ReviewStep";
import { LanguageSwitcher } from "./components/layout/LanguageSwitcher";

import { transformToBackendPayload } from "./utils/image";
import type { SessionPatch } from "./lib/services/session.service";
import DocumentStep from "./components/steps/document/DocumentStep";
import SignatureStep from "./components/steps/Signaturestep";

// ── Auto-save helper ──────────────────────────────────────────────────────────
// Consolidates the rehydration guard so it isn't copy-pasted across 10 effects.
// Only saves once the mount rehydration has completed (isRehydrating.current = false).

function useSaveSession(
  patch: SessionPatch,
  isRehydrating: React.RefObject<boolean>,
  deps: unknown[],
) {
  useEffect(() => {
    if (isRehydrating.current) return;
    saveSession(patch);
    // deps drives when this fires — patch is intentionally not in the array
    // because we only want to save when the underlying values change, not
    // when the object reference changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  const selfieWebcamRef = useRef<Webcam | null>(null);
  const docWebcamRef = useRef<Webcam | null>(null);

  // Prevents auto-save watchers from overwriting restored session data on mount.
  const isRehydrating = useRef(true);

  // ── Flow ──────────────────────────────────────────────────────────────────
  const {
    stepIndex,
    maxStepReached,
    activeStep,
    error,
    agreed,
    setAgreed,
    nextStep,
    prevStep,
    goToStep,
    pushError,
    clearError,
    resetFlow,
  } = useKYCFlow();

  // ── Models ────────────────────────────────────────────────────────────────
  const { modelsLoaded } = useModels(pushError);

  // ── Session timers ────────────────────────────────────────────────────────
  // Reads only from localStorage — no dependency on any React state.
  const timers = useSessionTimers();

  // ── MSISDN ────────────────────────────────────────────────────────────────
  // Declared before the rehydration effect so setMsisdn is available when it runs.
  const [msisdn, setMsisdn] = useState("");

  // ── Document type ─────────────────────────────────────────────────────────
  const [docType, setDocType] = useState("");

  // ── Signature ─────────────────────────────────────────────────────────────
  const [signatureImage, setSignatureImageState] = useState("");

  const setSignatureImage = (dataUrl: string) => {
    setSignatureImageState(dataUrl);
    saveSession({ signatureImage: dataUrl });
  };

  // ── Liveness ──────────────────────────────────────────────────────────────
  const {
    phase,
    landmarkStatus,
    livenessCompleted,
    livenessChallenge,
    livenessDone,
    challengeSequence,
    challengeIndex,
    challengeTimeLeft,
    startChallenges,
    retryChallenge,
    resetLiveness,
  } = useFaceLiveness({
    webcamRef: selfieWebcamRef,
    modelsLoaded,
    active: activeStep.key === "selfie",
    challengeCount: 3,
  });

  // ── Selfie ────────────────────────────────────────────────────────────────
  const {
    selfieImage,
    faceSidePhoto,
    captureStatus,
    captureSelfie,
    captureFaceSidePhoto,
    resetSelfie,
    setSelfieImage,
    setFaceSidePhoto,
  } = useSelfie({
    webcamRef: selfieWebcamRef,
    livenessDone,
    yawEstimate: landmarkStatus.yawEstimate,
    faceQualityOk: landmarkStatus.qualityOk,
    faceDetected: landmarkStatus.faceDetected,
    pushError,
    clearError,
    nextStep,
  });

  // ── Document ──────────────────────────────────────────────────────────────
  const {
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
    rehydrateDocument,
    resetDocument,
  } = useDocument({ docWebcamRef, pushError, clearError });

  // ── OCR & MRZ ─────────────────────────────────────────────────────────────
  const {
    fields,
    setFields,
    mrzValid,
    mrzMessage,
    busy: ocrBusy,
    runOCRAndMRZ,
    rehydrateOCR,
    resetOCR,
  } = useOCR({ documentImage, pushError, clearError, nextStep });

  // ── Face match ────────────────────────────────────────────────────────────
  const {
    faceMatch,
    busy: matchBusy,
    runFaceMatch,
    rehydrateFaceMatch,
    resetFaceMatch,
  } = useFaceMatch({
    selfieImage,
    documentImage,
    pushError,
    clearError,
    nextStep,
  });

  // ── Rehydration ───────────────────────────────────────────────────────────
  // Single effect, single loadSession() call.
  // requestAnimationFrame ensures all batched setState calls above have
  // committed before auto-save watchers are allowed to fire.
  useEffect(() => {
    const s = loadSession();

    if (s) {
      if (s.msisdn) setMsisdn(s.msisdn);
      if (s.docType) setDocType(s.docType);
      if (s.selfieImage) setSelfieImage(s.selfieImage);
      if (s.faceSidePhoto) setFaceSidePhoto(s.faceSidePhoto);
      if (s.signatureImage) setSignatureImageState(s.signatureImage);

      rehydrateDocument({
        documentImage: s.documentImage,
        documentBackImage: s.documentBackImage,
        documentQuality: s.documentQuality,
        documentBackQuality: s.documentBackQuality,
      });

      rehydrateOCR({
        fields: s.fields,
        mrzValid: s.mrzValid,
        mrzMessage: s.mrzMessage,
      });

      rehydrateFaceMatch({ faceMatch: s.faceMatch });
    }

    requestAnimationFrame(() => {
      isRehydrating.current = false;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // ── Expiry watcher ────────────────────────────────────────────────────────
  // Registered immediately after rehydration — cleans up both the KYC session
  // and the OTP token when their 15-min TTL elapses.
  useEffect(() => startExpiryWatcher(), []);

  // ── Auto-save watchers ────────────────────────────────────────────────────
  // Each patch is saved independently so unrelated state changes don't trigger
  // a full-session write. The rehydration guard is enforced inside useSaveSession.
  useSaveSession({ msisdn }, isRehydrating, [msisdn]);
  useSaveSession({ docType }, isRehydrating, [docType]);
  useSaveSession({ selfieImage }, isRehydrating, [selfieImage]);
  useSaveSession({ faceSidePhoto }, isRehydrating, [faceSidePhoto]);
  useSaveSession({ signatureImage }, isRehydrating, [signatureImage]);
  useSaveSession({ documentImage }, isRehydrating, [documentImage]);
  useSaveSession({ documentBackImage }, isRehydrating, [documentBackImage]);
  useSaveSession({ documentQuality }, isRehydrating, [documentQuality]);
  useSaveSession({ documentBackQuality }, isRehydrating, [documentBackQuality]);
  useSaveSession({ fields }, isRehydrating, [fields]);
  useSaveSession({ mrzValid, mrzMessage }, isRehydrating, [
    mrzValid,
    mrzMessage,
  ]);
  useSaveSession({ faceMatch }, isRehydrating, [faceMatch]);

  // ── Payload ───────────────────────────────────────────────────────────────
  const internalPayload = useMemo(
    () =>
      buildPayload({
        consentAccepted: agreed,
        selfieImage,
        faceSidePhoto,
        documentImage,
        documentBackImage,
        livenessDone,
        livenessCompleted,
        finalYawEstimate: landmarkStatus.yawEstimate,
        signatureImage,
        documentQuality,
        fields,
        mrzValid,
        mrzMessage,
        faceMatch,
      }),
    [
      agreed,
      selfieImage,
      faceSidePhoto,
      documentImage,
      documentBackImage,
      livenessDone,
      livenessCompleted,
      landmarkStatus.yawEstimate,
      signatureImage,
      documentQuality,
      fields,
      mrzValid,
      mrzMessage,
      faceMatch,
    ],
  );

  const backendPayload = useMemo(
    () => transformToBackendPayload(internalPayload, msisdn, docType),
    [internalPayload, msisdn, docType],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () =>
    resetFlow(() => {
      resetSelfie();
      resetDocument();
      resetOCR();
      resetFaceMatch();
      resetLiveness();
      setMsisdn("");
      setSignatureImageState("");
      setDocType("");
    });

  // ── Export payload ────────────────────────────────────────────────────────
  const exportPayloadFile = () => {
    const blob = new Blob([JSON.stringify(backendPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kyc-payload-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-20 bg-[#a11775] flex justify-center flex-col text-slate-100">
      <LanguageSwitcher timers={timers} />

      <div className="mx-auto max-w-7xl flex flex-col justify-center sm:py-10 py-3">
        <Header
          modelsLoaded={modelsLoaded}
          activeStepLabel={activeStep.label}
        />
        <Stepper
          steps={steps}
          stepIndex={stepIndex}
          maxStepReached={maxStepReached}
          onStepClick={goToStep}
        />

        {error && (
          <div className="mb-6 rounded-2xl border border-[#ee7d00] bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            <strong className="mr-2 uppercase tracking-wide">
              {error.scope}
            </strong>
            {error.message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] w-full">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
            {activeStep.key === "msisdn" && (
              <MSISDNStep
                msisdn={msisdn}
                setMsisdn={setMsisdn}
                nextStep={nextStep}
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
                faceSidePhoto={faceSidePhoto}
                captureFaceSidePhoto={captureFaceSidePhoto}
                livenessChallenge={livenessChallenge}
                challengeSequence={challengeSequence}
                challengeIndex={challengeIndex}
                challengeTimeLeft={challengeTimeLeft}
                phase={phase}
                startChallenges={startChallenges}
                retryChallenge={retryChallenge}
                retakeSelfie={() => {
                  resetSelfie();
                  resetLiveness();
                }}
                captureStatus={captureStatus}
              />
            )}

            {activeStep.key === "signature" && (
              <SignatureStep
                signatureImage={signatureImage}
                setSignatureImage={setSignatureImage}
                nextStep={nextStep}
                prevStep={prevStep}
              />
            )}

            {activeStep.key === "document" && (
              <DocumentStep
                docType={docType}
                setDocType={setDocType}
                documentPreviewMode={documentPreviewMode}
                setDocumentPreviewMode={setDocumentPreviewMode}
                docWebcamRef={docWebcamRef}
                captureDocument={captureDocument}
                captureDocumentBack={captureDocumentBack}
                handleDocumentUpload={handleDocumentUpload}
                handleDocumentBackUpload={handleDocumentBackUpload}
                documentImage={documentImage}
                documentBackImage={documentBackImage}
                runOCRAndMRZ={runOCRAndMRZ}
                prevStep={prevStep}
                docVideoConstraints={docVideoConstraints}
                documentQuality={documentQuality}
                documentBackQuality={documentBackQuality}
                saveDocumentBlobLocally={saveDocumentBlobLocally}
                saveDocumentBackBlobLocally={saveDocumentBackBlobLocally}
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
                internalPayload={internalPayload}
                backendPayload={backendPayload}
                prevStep={prevStep}
                exportPayloadFile={exportPayloadFile}
                resetFlow={handleReset}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
