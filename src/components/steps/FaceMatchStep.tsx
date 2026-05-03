import { useEffect, useRef, useState } from "react";
import type { FaceMatchResult } from "../../types/kyc";
import * as faceapi from "face-api.js";
import { dataUrlToImage } from "../../utils/image";

type Props = {
  selfieImage: string;
  documentImage: string;
  faceMatch: FaceMatchResult | null;
  prevStep: () => void;
  nextStep: () => void;
};

/** Reproduces exactly what cropFaceCanvas does so we can see what face-api is feeding into the descriptor */
async function buildDebugCrops(
  selfieDataUrl: string,
  docDataUrl: string,
): Promise<{ selfie: string; doc: string; selfieBox: string; docBox: string }> {
  const [selfieImg, docImg] = await Promise.all([
    dataUrlToImage(selfieDataUrl),
    dataUrlToImage(docDataUrl),
  ]);

  async function cropFor(
    img: HTMLImageElement,
    label: string,
  ): Promise<{ cropped: string; boxInfo: string }> {
    const SIZE = 224;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    // Try SSD first
    let box: faceapi.Box | null = null;
    let detector = "none";

    if (faceapi.nets.ssdMobilenetv1.isLoaded) {
      const det = await faceapi
        .detectSingleFace(
          img,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }),
        )
        .withFaceLandmarks();
      if (det) {
        box = det.detection.box;
        detector = "SSD";
      }
    }

    if (!box) {
      const det = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.3,
          }),
        )
        .withFaceLandmarks();
      if (det) {
        box = det.detection.box;
        detector = "Tiny";
      }
    }

    if (!box) {
      // No face — draw full image
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      return {
        cropped: canvas.toDataURL("image/jpeg", 0.92),
        boxInfo: `${label}: ❌ NO FACE DETECTED (${img.naturalWidth}×${img.naturalHeight})`,
      };
    }

    const pad = Math.max(box.width, box.height) * 0.3;
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    const w = Math.min(img.naturalWidth - x, box.width + pad * 2);
    const h = Math.min(img.naturalHeight - y, box.height + pad * 2);

    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.drawImage(img, x, y, w, h, 0, 0, SIZE, SIZE);

    return {
      cropped: canvas.toDataURL("image/jpeg", 0.92),
      boxInfo: `${label}: ✅ ${detector} | box (${Math.round(box.x)},${Math.round(box.y)}) ${Math.round(box.width)}×${Math.round(box.height)} | src ${img.naturalWidth}×${img.naturalHeight}`,
    };
  }

  const [selfieResult, docResult] = await Promise.all([
    cropFor(selfieImg, "Selfie"),
    cropFor(docImg, "Document"),
  ]);

  return {
    selfie: selfieResult.cropped,
    doc: docResult.cropped,
    selfieBox: selfieResult.boxInfo,
    docBox: docResult.boxInfo,
  };
}

export default function FaceMatchStep({
  selfieImage,
  documentImage,
  faceMatch,
  prevStep,
  nextStep,
}: Props) {
  const [debugCrops, setDebugCrops] = useState<{
    selfie: string;
    doc: string;
    selfieBox: string;
    docBox: string;
  } | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const didRun = useRef(false);

  useEffect(() => {
    if (!selfieImage || !documentImage || didRun.current) return;
    didRun.current = true;
    setDebugLoading(true);
    buildDebugCrops(selfieImage, documentImage)
      .then(setDebugCrops)
      .catch(console.error)
      .finally(() => setDebugLoading(false));
  }, [selfieImage, documentImage]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Face match result</h2>
        <p className="mt-1 text-sm text-slate-300">
          The document portrait is compared against the selfie using
          browser-side face descriptors.
        </p>
      </div>

      {/* Original images */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
          <div className="mb-3 text-sm text-slate-300">Selfie</div>
          {selfieImage ? (
            <img
              src={selfieImage}
              alt="Selfie"
              className="rounded-2xl w-full"
            />
          ) : (
            <div className="text-slate-400">No selfie.</div>
          )}
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
          <div className="mb-3 text-sm text-slate-300">Document image</div>
          {documentImage ? (
            <img
              src={documentImage}
              alt="Document"
              className="rounded-2xl w-full"
            />
          ) : (
            <div className="text-slate-400">No document.</div>
          )}
        </div>
      </div>

      {/* Debug crop preview */}
      <div className="rounded-3xl border border-amber-800/50 bg-amber-950/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-wide text-amber-400 font-semibold">
            🔬 Debug: What face-api actually sees
          </div>
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="text-xs text-amber-300 underline"
          >
            {showDebug ? "Hide" : "Show"} crop preview
          </button>
        </div>

        {showDebug && (
          <>
            {debugLoading && (
              <div className="text-sm text-amber-300 animate-pulse">
                Running crop detection…
              </div>
            )}

            {debugCrops && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 mb-4">
                  <div className="rounded-2xl bg-slate-900 p-3">
                    <div className="text-xs text-slate-400 mb-2">
                      Selfie crop (224×224 fed to descriptor)
                    </div>
                    <img
                      src={debugCrops.selfie}
                      alt="Selfie crop"
                      className="rounded-xl w-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-3">
                    <div className="text-xs text-slate-400 mb-2">
                      Document crop (224×224 fed to descriptor)
                    </div>
                    <img
                      src={debugCrops.doc}
                      alt="Document crop"
                      className="rounded-xl w-full"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div
                    className={`text-xs font-mono px-3 py-2 rounded-xl ${
                      debugCrops.selfieBox.includes("❌")
                        ? "bg-red-950 text-red-300"
                        : "bg-slate-900 text-emerald-300"
                    }`}
                  >
                    {debugCrops.selfieBox}
                  </div>
                  <div
                    className={`text-xs font-mono px-3 py-2 rounded-xl ${
                      debugCrops.docBox.includes("❌")
                        ? "bg-red-950 text-red-300"
                        : "bg-slate-900 text-emerald-300"
                    }`}
                  >
                    {debugCrops.docBox}
                  </div>
                </div>

                <div className="mt-3 text-xs text-amber-200/70">
                  If the document crop shows the full passport instead of just
                  the face, face-api failed to detect the face region — increase
                  padding or lower minConfidence. If either crop shows ❌, the
                  descriptor is running on the full image which degrades
                  accuracy significantly.
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Decision */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-300">
        <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
          Decision
        </div>
        {faceMatch ? (
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-900 p-4">
              Distance
              <br />
              <span className="text-xl font-semibold text-cyan-300">
                {faceMatch.distance}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              Similarity
              <br />
              <span className="text-xl font-semibold text-cyan-300">
                {faceMatch.similarity}%
              </span>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              Threshold
              <br />
              <span className="text-xl font-semibold text-cyan-300">
                {faceMatch.threshold}
              </span>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4">
              Status
              <br />
              <span
                className={
                  faceMatch.passed
                    ? "text-xl font-semibold text-emerald-300"
                    : "text-xl font-semibold text-amber-300"
                }
              >
                {faceMatch.passed ? "Passed" : "Review needed"}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-400">No result yet.</div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950"
        >
          Continue to payload review
        </button>
      </div>
    </section>
  );
}
