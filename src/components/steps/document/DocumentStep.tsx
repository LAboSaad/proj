// src/components/steps/document/DocumentStep.tsx

import Webcam from "react-webcam";
import type { DocumentQuality } from "../../../types/kyc";
import { cx } from "../../../lib/utils";
import { DocumentSide } from "./DocumentSide";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocumentStepProps {
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
  return (
    <section className="space-y-5">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-semibold">Document capture</h2>
        <p className="mt-1 text-sm text-slate-300">
          Capture or upload a clear passport, national ID, or driver licence.
          A passport data page gives the best MRZ results.
        </p>
      </div>

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
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

      {/* ── Front side ────────────────────────────────────────────────────── */}
      <DocumentSide
        side="front"
        previewMode={documentPreviewMode}
        docWebcamRef={docWebcamRef}
        docVideoConstraints={docVideoConstraints}
        image={documentImage}
        quality={documentQuality}
        onCapture={() => void captureDocument()}
        onUpload={(e) => void handleDocumentUpload(e)}
        onDownload={() => void saveDocumentBlobLocally()}
      />

      {/* ── Back side (revealed after front is captured) ───────────────────── */}
      {documentImage && (
        <div className="border-t border-slate-800 pt-5">
          <DocumentSide
            side="back"
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
          disabled={!documentImage || busy}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950
            hover:bg-cyan-400 transition-colors
            disabled:cursor-not-allowed disabled:opacity-40"
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