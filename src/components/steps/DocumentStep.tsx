import Webcam from "react-webcam";
import { cx } from "../../lib/utils";

export default function DocumentStep({
  documentPreviewMode,
  setDocumentPreviewMode,
  docWebcamRef,
  captureDocument,
  captureDocumentBack,
  handleDocumentUpload,
  handleDocumentBackUpload,
  documentImage,
  documentBackImage,
  runOCRAndMRZ,
  prevStep,
  docVideoConstraints,
  documentQuality,
  documentBackQuality,
  saveDocumentBlobLocally,
  saveDocumentBackBlobLocally,
  busy,
}: any) {
  const QualityPanel = ({ quality }: { quality: any }) => (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
      <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
        Quality checks
      </div>
      {quality ? (
        <div className="space-y-2">
          <div>
            Resolution:{" "}
            <span className="text-cyan-300">
              {quality.width} × {quality.height}
            </span>
          </div>
          <div>
            Brightness:{" "}
            <span className="text-cyan-300">{quality.brightness}</span>
          </div>
          <div>
            Contrast: <span className="text-cyan-300">{quality.contrast}</span>
          </div>
          <div>
            Blur score:{" "}
            <span className="text-cyan-300">{quality.blurScore}</span>
          </div>
          <div>
            Glare ratio:{" "}
            <span className="text-cyan-300">{quality.glareRatio}</span>
          </div>
          <div>
            Verdict:{" "}
            <span
              className={
                quality.looksUsefulForOCR
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {quality.looksUsefulForOCR ? "Good for OCR" : "Needs improvement"}
            </span>
          </div>
          {quality.reasons.length > 0 && (
            <ul className="mt-3 space-y-2 rounded-2xl bg-slate-900 p-3 text-xs text-slate-200">
              {quality.reasons.map((reason: any) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="text-slate-400">No quality analysis yet.</div>
      )}
    </div>
  );

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Document capture</h2>
        <p className="mt-1 text-sm text-slate-300">
          Capture or upload a clear passport or ID image. A passport data page
          works best for MRZ.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setDocumentPreviewMode("camera")}
          className={cx(
            "rounded-2xl px-4 py-2 text-sm",
            documentPreviewMode === "camera"
              ? "bg-cyan-500 text-slate-950"
              : "border border-slate-700 text-slate-200",
          )}
        >
          Camera
        </button>
        <button
          onClick={() => setDocumentPreviewMode("upload")}
          className={cx(
            "rounded-2xl px-4 py-2 text-sm",
            documentPreviewMode === "upload"
              ? "bg-cyan-500 text-slate-950"
              : "border border-slate-700 text-slate-200",
          )}
        >
          Upload image
        </button>
      </div>
      {/* ── FRONT ── */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Front of document
        </h3>

        {documentPreviewMode === "camera" ? (
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
            <span className="text-lg font-medium">
              Upload front of passport or ID
            </span>
            <span className="mt-2 text-sm text-slate-400">
              PNG or JPG. Prefer a flat, sharp image with visible MRZ.
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleDocumentUpload(e)}
            />
          </label>
        )}

        {documentImage && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
              <div className="mb-3 text-sm text-slate-300">
                Front document image
              </div>
              <img
                src={documentImage}
                alt="Document front"
                className="rounded-2xl object-contain"
              />
            </div>
            <QualityPanel quality={documentQuality} />
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {documentPreviewMode === "camera" && (
            <button
              onClick={() => void captureDocument()}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
            >
              Capture front
            </button>
          )}
          <button
            onClick={() => void saveDocumentBlobLocally()}
            disabled={!documentImage}
            className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 disabled:opacity-40"
          >
            Download front
          </button>
        </div>
      </div>
      {/* ── BACK ── */}
      {documentImage && ( // ← add this condition wrapping the entire back section
        <div className="space-y-3 border-t border-slate-800 pt-5">
          <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">
            Back of document
          </h3>

          {documentPreviewMode === "camera" ? (
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
              <span className="text-lg font-medium">
                Upload back of passport or ID
              </span>
              <span className="mt-2 text-sm text-slate-400">
                PNG or JPG. Make sure the image is clear and flat.
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleDocumentBackUpload(e)}
              />
            </label>
          )}

          {documentBackImage && (
            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-3 text-sm text-slate-300">
                  Back document image
                </div>
                <img
                  src={documentBackImage}
                  alt="Document back"
                  className="rounded-2xl object-contain"
                />
              </div>
              <QualityPanel quality={documentBackQuality} />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {documentPreviewMode === "camera" && (
              <button
                onClick={() => void captureDocumentBack()}
                className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
              >
                Capture back
              </button>
            )}
            <button
              onClick={() => void saveDocumentBackBlobLocally()}
              disabled={!documentBackImage}
              className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 disabled:opacity-40"
            >
              Download back
            </button>
          </div>
        </div>
      )}{" "}
      {/* ← closes the condition */}
      {/* ── ACTIONS ── */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
        >
          Back
        </button>
        <button
          onClick={() => void runOCRAndMRZ()}
          disabled={!documentImage || busy}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run OCR and MRZ with AI
        </button>
      </div>
    </section>
  );
}
