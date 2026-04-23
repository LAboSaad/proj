import type { FaceMatchResult } from "../../types/kyc";

type Props = {
  selfieImage: string;
  documentImage: string;
  faceMatch: FaceMatchResult | null;
  prevStep: () => void;
  nextStep: () => void;
};


export default function FaceMatchStep({

  
  selfieImage,
  documentImage,
  faceMatch,
  prevStep,
  nextStep,
}: Props) {
  return (
 <section className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">Face match result</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    The document portrait is compared against the selfie using browser-side face descriptors.
                  </p>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-sm text-slate-300">Selfie</div>
                    {selfieImage ? <img src={selfieImage} alt="Selfie" className="rounded-2xl" /> : <div className="text-slate-400">No selfie.</div>}
                  </div>
                  <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-3 text-sm text-slate-300">Document image</div>
                    {documentImage ? <img src={documentImage} alt="Document" className="rounded-2xl" /> : <div className="text-slate-400">No document.</div>}
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-300">
                  <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">Decision</div>
                  {faceMatch ? (
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-slate-900 p-4">Distance<br /><span className="text-xl font-semibold text-cyan-300">{faceMatch.distance}</span></div>
                      <div className="rounded-2xl bg-slate-900 p-4">Similarity<br /><span className="text-xl font-semibold text-cyan-300">{faceMatch.similarity}%</span></div>
                      <div className="rounded-2xl bg-slate-900 p-4">Threshold<br /><span className="text-xl font-semibold text-cyan-300">{faceMatch.threshold}</span></div>
                      <div className="rounded-2xl bg-slate-900 p-4">Status<br /><span className={faceMatch.passed ? "text-xl font-semibold text-emerald-300" : "text-xl font-semibold text-amber-300"}>{faceMatch.passed ? "Passed" : "Review needed"}</span></div>
                    </div>
                  ) : (
                    <div className="text-slate-400">No result yet.</div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={prevStep} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                    Back
                  </button>
                  <button onClick={nextStep} className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950">
                    Continue to payload review
                  </button>
                </div>
              </section>
  );
}