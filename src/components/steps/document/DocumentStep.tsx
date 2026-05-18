// src/components/steps/document/DocumentStep.tsx

import Webcam from "react-webcam";
import type { DocumentQuality } from "../../../types/kyc";
import { cx } from "../../../lib/utils";
import { DocumentSide } from "./DocumentSide";
import passportSample from "../../../assets/passport-sample.png";

// ── Document type options ─────────────────────────────────────────────────────

const DOC_TYPES = [
  {
    id: "passport",
    label: "Passport",
    icon: "🛂",
    hint: "Open to the photo/data page. Ensure the MRZ (two lines of text at the bottom) is fully visible.",
  },
  {
    id: "national_id",
    label: "National ID",
    icon: "🪪",
    hint: "Capture the front side first, then the back. Make sure all four corners are visible.",
  },
  {
    id: "drivers_license",
    label: "Driver's License",
    icon: "🚗",
    hint: "Capture the front side first, then the back. Hold the card flat to avoid glare.",
  },
] as const;

type DocTypeId = (typeof DOC_TYPES)[number]["id"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentStepProps {
  docType:                     string;
  setDocType:                  (v: string) => void;
  documentPreviewMode:         "camera" | "upload";
  setDocumentPreviewMode:      (mode: "camera" | "upload") => void;
  docWebcamRef:                React.RefObject<Webcam | null>;
  docVideoConstraints:         MediaTrackConstraints;
  documentImage:               string;
  documentQuality:             DocumentQuality | null;
  documentBackImage:           string;
  documentBackQuality:         DocumentQuality | null;
  captureDocument:             () => Promise<void>;
  captureDocumentBack:         () => Promise<void>;
  handleDocumentUpload:        (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDocumentBackUpload:    (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  saveDocumentBlobLocally:     () => Promise<void>;
  saveDocumentBackBlobLocally: () => Promise<void>;
  runOCRAndMRZ:                () => Promise<void>;
  prevStep:                    () => void;
  busy:                        boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentStep({
  docType,
  setDocType,
  documentPreviewMode,
  setDocumentPreviewMode,
  docWebcamRef,
  docVideoConstraints,
  documentImage,
  documentQuality,
  documentBackImage,
  documentBackQuality,
  captureDocument,
  captureDocumentBack,
  handleDocumentUpload,
  handleDocumentBackUpload,
  saveDocumentBlobLocally,
  saveDocumentBackBlobLocally,
  runOCRAndMRZ,
  prevStep,
  busy,
}: DocumentStepProps) {
  const selectedDoc = DOC_TYPES.find((d) => d.id === docType);
  const docTypeSelected = !!docType;

  return (
    <section className="space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-semibold">Document capture</h2>
        <p className="mt-1 text-sm text-slate-300">
          Select your document type, then capture or upload a clear photo.
        </p>
      </div>

      {/* ── Document type selector ────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-sm font-medium text-slate-200">
          Document type <span className="text-rose-400">*</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {DOC_TYPES.map((doc) => {
            const selected = docType === doc.id;
            return (
              <button
                key={doc.id}
                type="button"
                onClick={() => setDocType(doc.id)}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center text-sm transition-all",
                  selected
                    ? "border-cyan-400 bg-cyan-500/15 text-cyan-100 shadow-md shadow-cyan-500/10"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800",
                )}
              >
                <span className="text-2xl">{doc.icon}</span>
                <span className="font-medium leading-tight">{doc.label}</span>
                {selected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Type-specific hint */}
        {selectedDoc && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-200">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {selectedDoc.hint}
          </div>
        )}

        {/* Passport capture guide */}
        {docType === "passport" && (
          <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-sm font-medium text-slate-200">How to capture your passport</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 p-4">
              <img
                src={passportSample}
                alt="Passport sample"
                className="w-full sm:w-56 rounded-xl object-contain border border-slate-700 bg-slate-800"
              />
              <ol className="flex flex-col gap-2 text-sm text-slate-300 list-none">
                {[
                  "Open your passport to the photo/data page.",
                  "Place it flat on a well-lit, dark surface.",
                  "Make sure all four corners of the page are visible.",
                  "Ensure the MRZ (two lines of text at the bottom) is fully readable.",
                  "Avoid glare, shadows, or any part of the page being covered.",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-semibold text-xs mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Validation error when no type selected and user tries to proceed */}
        {!docTypeSelected && documentImage && (
          <p className="mt-2 text-sm text-rose-400">
            Please select a document type before proceeding.
          </p>
        )}
      </div>

      {/* ── Capture UI (only shown after doc type is selected) ────────────── */}
      {docTypeSelected && (
        <>
          {/* ── Mode toggle ─────────────────────────────────────────────── */}
          <div className="flex gap-2">
            {(["camera", "upload"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDocumentPreviewMode(mode)}
                className={cx(
                  "rounded-2xl px-4 py-2 text-sm capitalize transition-colors",
                  documentPreviewMode === mode
                    ? "bg-cyan-500 text-slate-950"
                    : "border border-slate-700 text-slate-200 hover:bg-slate-800",
                )}
              >
                {mode === "camera" ? "Camera" : "Upload image"}
              </button>
            ))}
          </div>

          {/* ── Front side ──────────────────────────────────────────────── */}
          <DocumentSide
            side="front"
            docType={docType}
            previewMode={documentPreviewMode}
            docWebcamRef={docWebcamRef}
            docVideoConstraints={docVideoConstraints}
            image={documentImage}
            quality={documentQuality}
            onCapture={() => void captureDocument()}
            onUpload={(e) => void handleDocumentUpload(e)}
            onDownload={() => void saveDocumentBlobLocally()}
          />

          {/* ── Back side (revealed after front is captured) ─────────────── */}
          {documentImage && (
            <div className="border-t border-slate-800 pt-5">
              <DocumentSide
                side="back"
                docType={docType}
                previewMode={documentPreviewMode}
                docWebcamRef={docWebcamRef}
                docVideoConstraints={docVideoConstraints}
                image={documentBackImage}
                quality={documentBackQuality}
                onCapture={() => void captureDocumentBack()}
                onUpload={(e) => void handleDocumentBackUpload(e)}
                onDownload={() => void saveDocumentBackBlobLocally()}
              />
            </div>
          )}
        </>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Back
        </button>

        <button
          onClick={() => void runOCRAndMRZ()}
          disabled={!documentImage || !docTypeSelected || busy}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950
            hover:bg-cyan-400 transition-colors
            disabled:cursor-not-allowed disabled:opacity-40"
          title={!docTypeSelected ? "Select a document type first" : undefined}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
              Running OCR…
            </span>
          ) : (
            "Run OCR & MRZ"
          )}
        </button>
      </div>
    </section>
  );
}
