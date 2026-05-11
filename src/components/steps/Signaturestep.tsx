import { useRef, useState } from "react";

// ── Config ─────────────────────────────────────────────────────────────────────

const MAX_FILE_MB    = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

// ── Types ──────────────────────────────────────────────────────────────────────

interface SignatureStepProps {
  signatureImage: string;
  setSignatureImage: (dataUrl: string) => void;
  nextStep: () => void;
  prevStep: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(String(r.result ?? ""));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SignatureStep({
  signatureImage,
  setSignatureImage,
  nextStep,
  prevStep,
}: SignatureStepProps) {
  const fileRef              = useRef<HTMLInputElement>(null);
  const [error, setError]    = useState("");
  const [hint, setHint]      = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ── File handler ─────────────────────────────────────────────────────────

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setHint("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only JPG or PNG files are accepted.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_FILE_MB} MB.`);
      e.target.value = "";
      return;
    }

    // Basic quality hint — check image dimensions after load
    const dataUrl = await fileToDataUrl(file);
    const img     = new Image();
    img.onload = () => {
      if (img.naturalWidth < 200 || img.naturalHeight < 80) {
        setHint("Image looks very small — make sure the signature is legible.");
      }
      setSignatureImage(dataUrl);
    };
    img.src    = dataUrl;
    e.target.value = "";
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleNext = () => {
    setSubmitted(true);
    if (!signatureImage) {
      setError("Signature photo is required before continuing.");
      return;
    }
    nextStep();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Signature photo</h2>
        <p className="mt-1 text-sm text-slate-300">
          Upload a clear photo of your handwritten signature on a white background.
          Accepted formats: JPG, PNG · max {MAX_FILE_MB} MB.
        </p>
      </div>

      {/* Upload zone / preview */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4">
        {signatureImage ? (
          /* Preview */
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-600/40 bg-slate-900 p-4">
              <p className="mb-3 text-xs uppercase tracking-wide text-emerald-400">
                ✓ Signature captured
              </p>
              <img
                src={signatureImage}
                alt="Signature preview"
                className="max-h-48 w-full rounded-xl object-contain bg-white p-2"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setSignatureImage(""); setError(""); setHint(""); }}
                className="rounded-2xl border border-slate-700 px-5 py-3 text-sm text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Retake / replace
              </button>
            </div>
          </div>
        ) : (
          /* Upload zone */
          <button
            onClick={() => fileRef.current?.click()}
            className={`flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors
              ${submitted && !signatureImage
                ? "border-rose-500 bg-rose-500/5 hover:border-rose-400"
                : "border-slate-700 hover:border-slate-500 hover:bg-slate-900"
              }`}
          >
            <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <div>
              <p className="text-base font-medium text-slate-200">
                Click to upload signature photo
              </p>
              <p className="mt-1 text-sm text-slate-400">
                JPG or PNG · max {MAX_FILE_MB} MB
              </p>
            </div>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="hidden"
          onChange={(e) => void handleFile(e)}
        />

        {/* Tips */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tips for a good signature photo</p>
          <ul className="space-y-1 text-xs text-slate-400">
            <li>• Sign on plain white paper with a dark pen</li>
            <li>• Ensure the full signature is visible with no clipping</li>
            <li>• Avoid shadows, glare, and wrinkles on the paper</li>
            <li>• Photograph straight-on (not at an angle)</li>
          </ul>
        </div>
      </div>

      {/* Error / hint */}
      {error && (
        <p className="rounded-xl border border-rose-700/50 bg-rose-900/20 px-4 py-2.5 text-sm text-rose-300">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-2.5 text-sm text-amber-300">
          ⚠ {hint}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 hover:bg-cyan-400 transition-colors"
        >
          Continue
        </button>
      </div>
    </section>
  );
}