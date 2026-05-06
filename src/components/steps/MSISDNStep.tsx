// src/components/steps/MSISDNStep.tsx

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

// TODO: Replace with a real backend call once /captcha/verify is available.
async function verifyCaptchaToken(_token: string): Promise<boolean> {
  return true;
}

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

export default function MSISDNStep({
  msisdn,
  setMsisdn,
  nextStep,
}: MSISDNStepProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("IDLE");
  const [errors, setErrors] = useState<ErrorState>(EMPTY_ERRORS);
  const [loading, setLoading] = useState(false);
  // Seconds received from the server on the most recent generateOTP call
  const [otpTotalSeconds, setOtpTotalSeconds] = useState(0);

  const setError = useCallback(
    (field: keyof ErrorState, message: string) =>
      setErrors((prev) => ({ ...prev, [field]: message })),
    [],
  );

  const clearErrors = useCallback(() => setErrors(EMPTY_ERRORS), []);

  const maskedPhone = useMemo(
    () => msisdn.slice(0, -4).replace(/[^+\s]/g, "•") + msisdn.slice(-4),
    [msisdn],
  );

  const executeCaptcha = useCallback(
    async (action: string): Promise<string | null> => {
      if (!executeRecaptcha) {
        setError(
          "captcha",
          "Security check not ready yet. Please wait a moment.",
        );
        return null;
      }
      return executeRecaptcha(action);
    },
    [executeRecaptcha, setError],
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      let cleaned = value.replace(/[^\d+\s]/g, "");
      if (cleaned.includes("+")) cleaned = "+" + cleaned.replace(/\+/g, "");
      setMsisdn(cleaned);
      clearErrors();
      if (phase === "REGISTERED") setPhase("IDLE");
    },
    [phase, setMsisdn, clearErrors],
  );

  // ── Send OTP — returns TokenValidity seconds on success ───────────────────

  const handleContinue = useCallback(async () => {
    clearErrors();

    if (!isValidE164(msisdn)) {
      setError(
        "input",
        "Enter a valid international number (e.g. +243970000001)",
      );
      return;
    }

    const token = await executeCaptcha("msisdn_check");
    if (!token) return;

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

      const validitySeconds = await generateOTP(msisdn); // ← server TTL
      setOtpTotalSeconds(validitySeconds);
      setPhase("OTP_SENT");
      setIsEligible(true);
    } catch (err) {
      console.error("[MSISDNStep] OTP generation error:", err);
      setError(
        "captcha",
        "Failed to send verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [msisdn, executeCaptcha, clearErrors, setError]);

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
            setError(
              "otp",
              "Too many incorrect attempts. Please request a new code.",
            );
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

  // ── Resend OTP — returns fresh TokenValidity seconds ─────────────────────

  const handleResend = useCallback(async (): Promise<number> => {
    clearOTP();
    clearErrors();
    setLoading(true);
    try {
      const validitySeconds = await generateOTP(msisdn); // ← fresh server TTL
      return validitySeconds;
    } catch (err) {
      console.error("[MSISDNStep] OTP resend error:", err);
      setError("otp", "Failed to resend code. Please try again.");
      return otpTotalSeconds; // fall back to previous value so timer isn't stuck at 0
    } finally {
      setLoading(false);
    }
  }, [msisdn, otpTotalSeconds, clearErrors, setError]);

  const handleBack = useCallback(() => {
    clearOTP();
    clearErrors();
    setPhase("IDLE");
  }, [clearErrors]);

  const showPhoneInput = phase === "IDLE" || phase === "REGISTERED";
  const showOTPInput = phase === "OTP_SENT";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Verify your number</h2>
        <p className="mt-1 text-sm text-slate-400">
          {showOTPInput
            ? "We sent a 6-digit code to your number."
            : "Enter your mobile number to get started."}
        </p>
      </div>

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
            initialSeconds={otpTotalSeconds}
          />

          <RecaptchaDisclaimer />
        </div>
      )}
    </section>
  );
}
