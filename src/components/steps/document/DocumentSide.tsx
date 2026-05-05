// src/components/steps/document/ui/DocumentSide.tsx
//
// Shared panel for front and back document capture/upload.
// Used twice in DocumentStep — once for each side — eliminating
// the copy-paste that existed in the original single-file version.

import Webcam from "react-webcam";
import { QualityPanel } from "./QualityPanel";
import type { DocumentQuality } from "../../../types/kyc";

interface DocumentSideProps {
  /** "front" | "back" — used for labels and alt text */
  side:                "front" | "back";
  previewMode:         "camera" | "upload";
  docWebcamRef:        React.RefObject<Webcam | null>;
  docVideoConstraints: MediaTrackConstraints;

  /** Captured / uploaded image data URL, or empty string */
  image:               string;
  quality:             DocumentQuality | null;

  onCapture:           () => void;
  onUpload:            (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload:          () => void;
}

const SIDE_LABELS = {
  front: {
    heading:       "Front of document",
    uploadTitle:   "Upload front of passport or ID",
    uploadHint:    "PNG or JPG. Prefer a flat, sharp image with visible MRZ.",
    captureButton: "Capture front",
    imageAlt:      "Document front",
    imageLabel:    "Front document image",
  },
  back: {
    heading:       "Back of document",
    uploadTitle:   "Upload back of passport or ID",
    uploadHint:    "PNG or JPG. Make sure the image is clear and flat.",
    captureButton: "Capture back",
    imageAlt:      "Document back",
    imageLabel:    "Back document image",
  },
} as const;

export function DocumentSide({
  side,
  previewMode,
  docWebcamRef,
  docVideoConstraints,
  image,
  quality,
  onCapture,
  onUpload,
  onDownload,
}: DocumentSideProps) {
  const labels = SIDE_LABELS[side];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">
        {labels.heading}
      </h3>

      {/* ── Input: camera or upload ──────────────────────────────────────── */}
      {previewMode === "camera" ? (
        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-black">
          <Webcam
            ref={docWebcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={docVideoConstraints}
            className="aspect-video w-full object-cover"
          />
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950 px-6 py-10 text-center text-slate-300">
          <span className="text-lg font-medium">{labels.uploadTitle}</span>
          <span className="mt-2 text-sm text-slate-400">{labels.uploadHint}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onUpload}
          />
        </label>
      )}

      {/* ── Preview + quality panel ───────────────────────────────────────── */}
      {image && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-3 text-sm text-slate-300">{labels.imageLabel}</div>
            <img
              src={image}
              alt={labels.imageAlt}
              className="rounded-2xl object-contain w-full"
            />
          </div>
          <QualityPanel quality={quality} />
        </div>
      )}

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {previewMode === "camera" && (
          <button
            onClick={onCapture}
            className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {labels.captureButton}
          </button>
        )}
        <button
          onClick={onDownload}
          disabled={!image}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 disabled:opacity-40 hover:bg-slate-800 transition-colors disabled:cursor-not-allowed"
        >
          Download {side}
        </button>
      </div>
    </div>
  );
}