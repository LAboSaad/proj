// src/hooks/useKYCFlow.ts
import { useCallback, useState } from "react";
import { steps } from "../lib/constants/kyc.constants";
import type { AppError } from "../types/kyc";

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

export function useKYCFlow(): UseKYCFlowReturn {
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError]         = useState<AppError | null>(null);
  const [agreed, setAgreed]       = useState(false);

  const pushError = useCallback((scope: string, message: string) => {
    setError({ scope, message });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const nextStep = useCallback(() => {
    clearError();
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [clearError]);

  const prevStep = useCallback(() => {
    clearError();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [clearError]);

  // accepts an optional extras callback so callers can reset their own state
  const resetFlow = useCallback((extras?: () => void) => {
    clearError();
    setStepIndex(0);
    setAgreed(false);
    extras?.();
  }, [clearError]);

  return {
    stepIndex,
    activeStep: steps[stepIndex],
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