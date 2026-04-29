import type { SubmissionPayload } from "../../types/kyc";
import { truncateDeep } from "../../utils/image";

type BackendPayload = {
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Gender: string;
  BirthDate: string;
  Address: string;
  Language: string;
  Email: string;
  Nationality: string;
  FaceFrontPhoto_b64: string;
  FaceSidePhoto_b64: string;
  IdDocType: string;
  IdDocSerialNumber: string;
  NationalIdNumber: string;
  IdDocFontPhoto_b64: string;
  IdDocRearPhoto_b64: string;
  SIMType: string;
  ICC: string;
  IMSI: string;
  MSISDNType: string;
  MSISDN: string;
  MobileMoney_Registration: boolean;
};

type Props = {
  internalPayload: SubmissionPayload;
  backendPayload: BackendPayload;
  prevStep: () => void;
  exportPayloadFile: () => void;
  submitToBackendBoundary: () => void;
  resetFlow: () => void;
};

export default function ReviewStep({
  internalPayload,
  backendPayload,
  prevStep,
  exportPayloadFile,
  submitToBackendBoundary,
  resetFlow,
}: Props) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Payload review</h2>
        <p className="mt-1 text-sm text-slate-300">
          Internal payload (debug) + Backend payload (final API format)
        </p>
      </div>

      {/* 🔹 Backend Payload (IMPORTANT) */}
      <div className="rounded-3xl border border-cyan-700 bg-slate-950 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-cyan-400">
          Backend Payload (THIS WILL BE SENT)
        </div>
        <pre className="overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">
          {JSON.stringify(truncateDeep(backendPayload), null, 2)}
        </pre>
      </div>

      {/* 🔹 Internal Payload (DEBUG) */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">
          Internal Payload (debug)
        </div>
        <pre className="overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">
          {JSON.stringify(truncateDeep(internalPayload), null, 2)}
        </pre>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={prevStep}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
        >
          Back
        </button>

        <button
          onClick={() => void exportPayloadFile()}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
        >
          Download JSON
        </button>

        <button
          onClick={() => void submitToBackendBoundary()}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950"
        >
          Send to backend
        </button>

        <button
          onClick={resetFlow}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200"
        >
          Restart flow
        </button>
      </div>
    </section>
  );
}