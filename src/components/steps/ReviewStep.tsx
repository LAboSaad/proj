import type { SubmissionPayload } from "../../types/kyc";

type Props = {
  payload: SubmissionPayload;
  prevStep: () => void;
  exportPayloadFile: () => void;       
  submitToBackendBoundary: () => void; 
  resetFlow: () => void;
};

export default function ReviewStep({
  payload,
  prevStep,
  exportPayloadFile,
  submitToBackendBoundary,
  resetFlow,
}: Props)  {
  return (
    <section className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">Payload review</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    The flow is complete up to the exact point where your app will POST this payload to the backend.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                  <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">JSON payload</div>
                  <pre className="max-h-[520px] overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">
                    {JSON.stringify(payload, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={prevStep} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                    Back
                  </button>
                  <button onClick={() => void exportPayloadFile()} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                    Download JSON
                  </button>
                  <button onClick={() => void submitToBackendBoundary()} className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950">
                    Ready for backend POST
                  </button>
                  <button onClick={resetFlow} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                    Restart flow
                  </button>
                </div>
              </section>
  );
}