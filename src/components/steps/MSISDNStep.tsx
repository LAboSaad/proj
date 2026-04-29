import { useState, useCallback } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import {
  checkMSISDN,
  generateOTP,
  verifyOTP,
  clearOTP,
  isValidE164,
} from "../../lib/services/msisdn.service";
import OTPSection from "./OTPSection";

// ── Types ──────────────────────────────────────────────────────────────────

type Phase = "IDLE" | "REGISTERED" | "OTP_SENT" | "VERIFIED";

interface MSISDNStepProps {
  msisdn: string;
  setMsisdn: (v: string) => void;
  setIsEligible: (v: boolean) => void;
  nextStep: () => void;
  isEligible: boolean | null;
}

// ── Mock captcha verifier ──────────────────────────────────────────────────

async function verifyCaptchaToken(token: string): Promise<boolean> {
  console.log("🔒 reCAPTCHA token (send to backend):", token);
  return true;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function MSISDNStep({
  msisdn,
  setMsisdn,
  setIsEligible,
  nextStep,
}: MSISDNStepProps) {
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [phase, setPhase] = useState<Phase>("IDLE");
  const [inputError, setInputError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [captchaError, setCaptchaError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Phone number input ─────────────────────────────────────────────────────
  const handlePhoneChange = (value: string) => {
    let cleaned = value.replace(/[^\d+\s]/g, "");
    if (cleaned.includes("+")) {
      cleaned = "+" + cleaned.replace(/\+/g, "");
    }
    setMsisdn(cleaned);
    setInputError("");
    setCaptchaError("");
    if (phase === "REGISTERED") setPhase("IDLE");
  };

  // ── Send OTP (guarded by reCAPTCHA) ───────────────────────────────────────
  const handleContinue = useCallback(async () => {
    setInputError("");
    setCaptchaError("");

    if (!isValidE164(msisdn)) {
      setInputError("Enter a valid international number (e.g. +243970000001)");
      return;
    }

    if (!executeRecaptcha) {
      setCaptchaError("Security check not ready yet. Please wait a moment.");
      return;
    }

    setLoading(true);
    try {
      const token = await executeRecaptcha("msisdn_check");
      const captchaOk = await verifyCaptchaToken(token);

      if (!captchaOk) {
        setCaptchaError("Security check failed. Please try again.");
        return;
      }

      const result = checkMSISDN(msisdn);

      if (result === "REGISTERED") {
        setPhase("REGISTERED");
        setInputError("This number is already registered.");
        setIsEligible(false);
        return;
      }

      await generateOTP(msisdn);
      setOtpError("");
      setPhase("OTP_SENT");
      setIsEligible(true);
    } catch (err) {
      console.error("OTP generation error:", err);
      setCaptchaError("Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [msisdn, executeRecaptcha, setIsEligible]);

  // ── Verify OTP (guarded by reCAPTCHA) ─────────────────────────────────────
  const handleVerify = useCallback(
    async (code: string) => {
      setOtpError("");
      setCaptchaError("");

      if (!executeRecaptcha) {
        setCaptchaError("Security check not ready yet. Please wait a moment.");
        return;
      }

      setLoading(true);
      try {
        const token = await executeRecaptcha("otp_verify");
        const captchaOk = await verifyCaptchaToken(token);

        if (!captchaOk) {
          setOtpError("Security check failed. Please try again.");
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
            setOtpError("Incorrect code — please try again.");
            break;
          case "EXPIRED":
            setOtpError("This code has expired. Please request a new one.");
            setPhase("IDLE");
            break;
          case "MAX_ATTEMPTS":
            setOtpError(
              "Too many incorrect attempts. Please request a new code.",
            );
            setPhase("IDLE");
            break;
        }
      } catch (err) {
        console.error("OTP verification error:", err);
        setOtpError("Verification failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [msisdn, executeRecaptcha, nextStep],
  );

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    clearOTP();
    setOtpError("");
    setCaptchaError("");
    setLoading(true);
    try {
      await generateOTP(msisdn);
    } catch (err) {
      console.error("OTP resend error:", err);
      setOtpError("Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [msisdn]);

  // ── Go back to phone input ─────────────────────────────────────────────────
  const handleBack = () => {
    clearOTP();
    setPhase("IDLE");
    setOtpError("");
    setCaptchaError("");
  };

  const maskedPhone =
    msisdn.slice(0, -4).replace(/[^+\s]/g, "•") + msisdn.slice(-4);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">Verify your number</h2>
        <p className="mt-1 text-sm text-slate-400">
          {phase === "OTP_SENT"
            ? "We sent a 6-digit code to your number."
            : "Enter your mobile number to get started."}
        </p>
      </div>

      {/* ── Phase: phone input ── */}
      {phase !== "OTP_SENT" && (
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
                inputError
                  ? "border-rose-500 focus:border-rose-400 focus:ring-rose-400/20"
                  : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-400/20"
              }`}
          />

          {inputError && (
            <p className="flex items-center gap-1.5 text-sm text-rose-400">
              <span>⚠</span> {inputError}
            </p>
          )}

          {captchaError && (
            <p className="flex items-center gap-1.5 text-sm text-amber-400">
              <span>🔒</span> {captchaError}
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
        </div>
      )}

      {/* ── Phase: OTP entry ── */}
      {phase === "OTP_SENT" && (
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

          {captchaError && (
            <p className="flex items-center gap-1.5 text-sm text-amber-400">
              <span>🔒</span> {captchaError}
            </p>
          )}

          <OTPSection
            onVerify={handleVerify}
            onResend={handleResend}
            error={otpError}
            loading={loading}
          />

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
        </div>
      )}
    </section>
  );
}
