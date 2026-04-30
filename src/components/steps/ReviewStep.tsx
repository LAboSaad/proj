import { useState } from "react";
import type { SubmissionPayload } from "../../types/kyc";
import { truncateDeep } from "../../utils/image";
import {
  apiSubmitSIMRegistration,
  type SIMRegistrationPayload,
} from "../../lib/api/kyc.api";
import axios from "axios";

const TOKEN_STORAGE_KEY = "kyc_otp_token";

function loadToken(): string {
  return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

type SubmitState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: unknown }
  | { status: "error"; message: string };

type Props = {
  internalPayload: SubmissionPayload;
  backendPayload: SIMRegistrationPayload;
  prevStep: () => void;
  exportPayloadFile: () => void;
  resetFlow: () => void;
};

export default function ReviewStep({
  internalPayload,
  backendPayload,
  prevStep,
  exportPayloadFile,
  resetFlow,
}: Props) {
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

 const handleSubmit = async () => {
  try {
    setSubmitState({ status: "loading" });

    const token = loadToken();
    if (!token) {
      setSubmitState({
        status: "error",
        message: "Session expired. Please restart the flow and verify your number again.",
      });
      return;
    }

    const response = await apiSubmitSIMRegistration(backendPayload, token);
    setSubmitState({ status: "success", data: response });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const body = err.response?.data;
      // Use ErrorDescription first, fall back to StatusDescription, then generic message
      const message =
        body?.ErrorDescription ||
        body?.StatusDescription ||
        err.message ||
        "Unexpected error occurred.";
      setSubmitState({ status: "error", message });
    } else {
      setSubmitState({
        status: "error",
        message: err instanceof Error ? err.message : "Unexpected error occurred.",
      });
    }
  }
};

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Payload review</h2>
        <p className="mt-1 text-sm text-slate-300">
          Internal payload (debug) + Backend payload (final API format)
        </p>
      </div>

      {submitState.status === "success" && (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
          <strong className="mr-2 uppercase tracking-wide">Success</strong>
          Registration submitted successfully.
          <pre className="mt-2 overflow-auto rounded-xl bg-emerald-950 p-3 text-xs text-emerald-100 whitespace-pre-wrap">
            {JSON.stringify(submitState.data, null, 2)}
          </pre>
        </div>
      )}

      {submitState.status === "error" && (
        <div className="rounded-2xl border border-rose-700 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          <strong className="mr-2 uppercase tracking-wide">Error</strong>
          {submitState.message}
        </div>
      )}

      <div className="rounded-3xl border border-cyan-700 bg-slate-950 p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-cyan-400">
          Backend Payload (this will be sent)
        </div>
        <pre className="overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-slate-100 whitespace-pre-wrap">
          {JSON.stringify(truncateDeep(backendPayload), null, 2)}
        </pre>
      </div>

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
          disabled={submitState.status === "loading"}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>

        <button
          onClick={exportPayloadFile}
          disabled={submitState.status === "loading"}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Download JSON
        </button>

        <button
          onClick={() => void handleSubmit()}
          disabled={submitState.status === "loading"}
          className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 hover:bg-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitState.status === "loading" ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
              Sending…
            </span>
          ) : submitState.status === "success" ? (
            "✓ Sent — resend?"
          ) : (
            "Send to backend"
          )}
        </button>

        <button
          onClick={resetFlow}
          disabled={submitState.status === "loading"}
          className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Restart flow
        </button>
      </div>
    </section>
  );
}