// src/components/steps/MSISDNStep.tsx
//
// Collects and verifies the user's mobile number via OTP.
//
//   • verifyCaptchaToken is a clearly-flagged stub (TODO) — always returns true
//     until the backend /captcha/verify endpoint is available.
//   • maskedPhone is memoised — not recomputed on every render.
//   • reCAPTCHA disclaimer extracted into <RecaptchaDisclaimer /> — was duplicated
//     in both phase branches.
//   • Phase guards are positive (showPhoneInput / showOTPInput) for easier scanning.
//   • Error state is a single grouped object — three useState calls collapsed into one.
//   • isEligible is internal state — App no longer needs to know about it.

import { useState, useCallback, useMemo } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import {
  checkMSISDN,
  generateOTP,
  verifyOTP,
  clearOTP,
  isValidE164,
} from "../../lib/services/msisdn.service";
import OTPSection from "./OTPSection";

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = "IDLE" | "REGISTERED" | "OTP_SENT" | "VERIFIED";

interface MSISDNStepProps {
  msisdn: string;
  setMsisdn: (v: string) => void;
  nextStep: () => void;
}

interface ErrorState {
  input: string;
  otp: string;
  captcha: string;
}

const EMPTY_ERRORS: ErrorState = { input: "", otp: "", captcha: "" };

// ── reCAPTCHA stub ────────────────────────────────────────────────────────────
// TODO: Replace with a real backend call once the /captcha/verify endpoint is
// available. Until then this always returns true so the flow is unblocked.
// The token should be POSTed server-side — never validated in the browser.

async function verifyCaptchaToken(_token: string): Promise<boolean> {
  return true;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function RecaptchaDisclaimer() {
  return (
    <p className="text-center text-xs text-slate-600">
      Protected by reCAPTCHA —{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-slate-400 transition-colors"
      >
        Privacy
      </a>{" "}
      &amp;{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-slate-400 transition-colors"
      >
        Terms
      </a>
    </p>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MSISDNStep({
  msisdn,
  setMsisdn,
  nextStep,
}: MSISDNStepProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  // isEligible is local — App does not need to know about it
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [errors, setErrors] = useState<ErrorState>(EMPTY_ERRORS);
  const [loading, setLoading] = useState(false);

  // Helper — update one error field without touching the others
  const setError = useCallback(
    (field: keyof ErrorState, message: string) =>
      setErrors((prev) => ({ ...prev, [field]: message })),
    [],
  );

  const clearErrors = useCallback(() => setErrors(EMPTY_ERRORS), []);

  // ── Derived ───────────────────────────────────────────────────────────────

  // Only recompute when msisdn changes — not on every render
  const maskedPhone = useMemo(
    () => msisdn.slice(0, -4).replace(/[^+\s]/g, "•") + msisdn.slice(-4),
    [msisdn],
  );

  // ── reCAPTCHA guard ───────────────────────────────────────────────────────
  // Shared between handleContinue and handleVerify so the "not ready" error
  // is never phrased differently depending on which button the user pressed.

  const executeCaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!executeRecaptcha) {
        setError("captcha", "Security check not ready yet. Please wait a moment.");
        return null;
      }
      return executeRecaptcha(action);
    },
    [executeRecaptcha, setError],
  );

  // ── Phone input ───────────────────────────────────────────────────────────

  const handlePhoneChange = useCallback(
    (value: string) => {
      // Allow digits, +, and spaces only. Enforce at most one leading +.
      let cleaned = value.replace(/[^\d+\s]/g, "");
      if (cleaned.includes("+")) {
        cleaned = "+" + cleaned.replace(/\+/g, "");
      }

      setMsisdn(cleaned);
      clearErrors();

      // If the user edits the number after a registration hit, reset to IDLE
      if (phase === "REGISTERED") setPhase("IDLE");
    },
    [phase, setMsisdn, clearErrors],
  );

  // ── Send OTP ──────────────────────────────────────────────────────────────

  const handleContinue = useCallback(async () => {
    clearErrors();

    if (!isValidE164(msisdn)) {
      setError("input", "Enter a valid international number (e.g. +243970000001)");
      return;
    }

    const token = await executeCaptcha("msisdn_check");
    if (!token) return; // executeCaptcha already set the error

    setLoading(true);
    try {
      const captchaOk = await verifyCaptchaToken(token);
      if (!captchaOk) {
        setError("captcha", "Security check failed. Please try again.");
        return;
      }

      const result = checkMSISDN(msisdn);

      if (result === "REGISTERED") {
        setPhase("REGISTERED");
        setError("input", "This number is already registered.");
        setIsEligible(false);
        return;
      }

      await generateOTP(msisdn);
      setPhase("OTP_SENT");
      setIsEligible(true);
    } catch (err) {
      console.error("[MSISDNStep] OTP generation error:", err);
      setError("captcha", "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [msisdn, executeCaptcha, setIsEligible, clearErrors, setError]);

  // ── Verify OTP ────────────────────────────────────────────────────────────

  const handleVerify = useCallback(
    async (code: string) => {
      clearErrors();

      const token = await executeCaptcha("otp_verify");
      if (!token) return;

      setLoading(true);
      try {
        const captchaOk = await verifyCaptchaToken(token);
        if (!captchaOk) {
          setError("otp", "Security check failed. Please try again.");
          return;
        }

        const result = await verifyOTP(msisdn, code);

        if (result.ok) {
          setPhase("VERIFIED");
          nextStep();
          return;
        }

        switch (result.reason) {
          case "WRONG_CODE":
            setError("otp", "Incorrect code — please try again.");
            break;
          case "EXPIRED":
            setError("otp", "This code has expired. Please request a new one.");
            setPhase("IDLE");
            break;
          case "MAX_ATTEMPTS":
            setError("otp", "Too many incorrect attempts. Please request a new code.");
            setPhase("IDLE");
            break;
        }
      } catch (err) {
        console.error("[MSISDNStep] OTP verification error:", err);
        setError("otp", "Verification failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [msisdn, executeCaptcha, nextStep, clearErrors, setError],
  );

  // ── Resend OTP ────────────────────────────────────────────────────────────

  const handleResend = useCallback(async () => {
    clearOTP();
    clearErrors();
    setLoading(true);
    try {
      await generateOTP(msisdn);
    } catch (err) {
      console.error("[MSISDNStep] OTP resend error:", err);
      setError("otp", "Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [msisdn, clearErrors, setError]);

  // ── Go back to phone input ────────────────────────────────────────────────

  const handleBack = useCallback(() => {
    clearOTP();
    clearErrors();
    setPhase("IDLE");
  }, [clearErrors]);

  // ── Render ────────────────────────────────────────────────────────────────

  const showPhoneInput = phase === "IDLE" || phase === "REGISTERED";
  const showOTPInput   = phase === "OTP_SENT";

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Verify your number</h2>
        <p className="mt-1 text-sm text-slate-400">
          {showOTPInput
            ? "We sent a 6-digit code to your number."
            : "Enter your mobile number to get started."}
        </p>
      </div>

      {/* ── Phase: phone input ────────────────────────────────────────────── */}
      {showPhoneInput && (
        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-widest text-slate-500">
            Mobile number
          </label>

          <input
            value={msisdn}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="+243 970 000 001"
            inputMode="tel"
            autoComplete="tel"
            disabled={loading}
            onKeyDown={(e) => e.key === "Enter" && void handleContinue()}
            className={`w-full rounded-2xl bg-slate-900 border px-4 py-3 text-slate-100
              placeholder:text-slate-600 outline-none transition-all focus:ring-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                errors.input
                  ? "border-rose-500 focus:border-rose-400 focus:ring-rose-400/20"
                  : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-400/20"
              }`}
          />

          {errors.input && (
            <p className="flex items-center gap-1.5 text-sm text-rose-400">
              <span>⚠</span> {errors.input}
            </p>
          )}

          {errors.captcha && (
            <p className="flex items-center gap-1.5 text-sm text-amber-400">
              <span>🔒</span> {errors.captcha}
            </p>
          )}

          <button
            onClick={() => void handleContinue()}
            disabled={!msisdn.trim() || loading}
            className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-slate-950
              disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-400
              transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
                Sending code…
              </>
            ) : (
              "Send verification code →"
            )}
          </button>

          <RecaptchaDisclaimer />
        </div>
      )}

      {/* ── Phase: OTP entry ──────────────────────────────────────────────── */}
      {showOTPInput && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Code sent to{" "}
              <span className="text-slate-200 font-medium">{maskedPhone}</span>
            </span>
            <button
              onClick={handleBack}
              className="text-cyan-400 hover:text-cyan-300 hover:underline text-xs transition-colors"
            >
              Change number
            </button>
          </div>

          {errors.captcha && (
            <p className="flex items-center gap-1.5 text-sm text-amber-400">
              <span>🔒</span> {errors.captcha}
            </p>
          )}

          <OTPSection
            onVerify={handleVerify}
            onResend={handleResend}
            error={errors.otp}
            loading={loading}
          />

          <RecaptchaDisclaimer />
        </div>
      )}
    </section>
  );
}