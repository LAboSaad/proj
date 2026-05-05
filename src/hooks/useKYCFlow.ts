// src/hooks/useKYCFlow.ts

import { useCallback, useEffect, useState } from "react";
import { steps } from "../lib/constants/kyc.constants";
import { loadSession, saveSession, clearSession } from "../lib/services/session.service";
import { isOTPTokenValid } from "../lib/services/msisdn.service";
import type { AppError, StepKey } from "../types/kyc";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UseKYCFlowReturn {
  stepIndex: number;
  activeStep: (typeof steps)[number];
  error: AppError | null;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  pushError: (scope: string, message: string) => void;
  clearError: () => void;
  resetFlow: (extras?: () => void) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveInitialIndex(): number {
  const session = loadSession();
  if (!session) return 0;
  const idx = steps.findIndex((s) => s.key === session.stepKey);
  return idx >= 0 ? idx : 0;
}

// Steps that require a valid OTP token to proceed.
// Step 0 (msisdn) is excluded — it's the destination we redirect back to.
const STEPS_REQUIRING_TOKEN = new Set(
  steps.slice(1).map((s) => s.key),
);

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useKYCFlow(): UseKYCFlowReturn {
  const [stepIndex, setStepIndex] = useState(resolveInitialIndex);
  const [error, setError] = useState<AppError | null>(null);
  const [agreed, setAgreedState] = useState(() => loadSession()?.agreed ?? false);

  // Persist step key whenever stepIndex changes
  useEffect(() => {
    const key = steps[stepIndex]?.key as StepKey;
    if (key) saveSession({ stepKey: key });
  }, [stepIndex]);

  const setAgreed = useCallback((v: boolean) => {
    setAgreedState(v);
    saveSession({ agreed: v });
  }, []);

  const pushError = useCallback((scope: string, message: string) => {
    setError({ scope, message });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const nextStep = useCallback(() => {
    const currentKey = steps[stepIndex]?.key;

    // Guard: if the current step requires a valid token and it has expired,
    // redirect to step 0 (msisdn) with a clear explanation.
    // msisdn is intentionally NOT cleared — the input stays pre-filled so
    // the user only needs to re-verify, not re-type their number.
    if (STEPS_REQUIRING_TOKEN.has(currentKey) && !isOTPTokenValid()) {
      setStepIndex(0);
      setError({
        scope: "Session expired",
        message:
          "Your verification session has expired. Please re-enter your number to receive a new code.",
      });
      return;
    }

    clearError();
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [stepIndex, clearError]);

  const prevStep = useCallback(() => {
    clearError();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [clearError]);

  const resetFlow = useCallback(
    (extras?: () => void) => {
      clearError();
      clearSession();
      setStepIndex(0);
      setAgreedState(false);
      extras?.();
    },
    [clearError],
  );

  const activeStep = steps[stepIndex] ?? steps[0];

  return {
    stepIndex,
    activeStep,
    error,
    agreed,
    setAgreed,
    nextStep,
    prevStep,
    pushError,
    clearError,
    resetFlow,
  };
}