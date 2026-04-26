import { useState } from "react";
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
  setIsEligible: (v: boolean) => void;
  nextStep: () => void;
  isEligible: boolean | null;
}

export default function MSISDNStep({
  msisdn,
  setMsisdn,
  setIsEligible,
  nextStep,
}: MSISDNStepProps) {
  const [phase, setPhase]       = useState<Phase>("IDLE");
  const [inputError, setInputError] = useState("");
  const [otpError, setOtpError]   = useState("");

  // ── Phone number input ─────────────────────────────────────────────────────
  const handlePhoneChange = (value: string) => {
    // Allow digits, +, spaces only
    let cleaned = value.replace(/[^\d+\s]/g, "");
    // Only one + at the very start
    if (cleaned.includes("+")) {
      cleaned = "+" + cleaned.replace(/\+/g, "");
    }
    setMsisdn(cleaned);
    setInputError("");
    // Reset if user edits after a check
    if (phase === "REGISTERED") setPhase("IDLE");
  };

  // ── Send OTP ───────────────────────────────────────────────────────────────
  const handleContinue = () => {
    setInputError("");

    if (!isValidE164(msisdn)) {
      setInputError("Enter a valid international number (e.g. +243970000001)");
      return;
    }

    const result = checkMSISDN(msisdn);

    if (result === "REGISTERED") {
      setPhase("REGISTERED");
      setInputError("This number is already registered.");
      setIsEligible(false);
      return;
    }

    // ELIGIBLE → fire OTP
    generateOTP();
    setOtpError("");
    setPhase("OTP_SENT");
    setIsEligible(true);
  };

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const handleVerify = (code: string) => {
    setOtpError("");
    const result = verifyOTP(code);

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
        setOtpError("Too many incorrect attempts. Please request a new code.");
        setPhase("IDLE");
        break;
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = () => {
    clearOTP();
    setOtpError("");
    generateOTP();
  };

  // ── Go back to phone input ─────────────────────────────────────────────────
  const handleBack = () => {
    clearOTP();
    setPhase("IDLE");
    setOtpError("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-6">
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
          <div className="relative">
            <input
              value={msisdn}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="+243 970 000 001"
              inputMode="tel"
              autoComplete="tel"
              onKeyDown={(e) => e.key === "Enter" && handleContinue()}
              className={`w-full rounded-2xl bg-slate-900 border px-4 py-3 text-slate-100 placeholder:text-slate-600
                outline-none transition-all focus:ring-2
                ${inputError
                  ? "border-rose-500 focus:border-rose-400 focus:ring-rose-400/20"
                  : "border-slate-700 focus:border-cyan-500 focus:ring-cyan-400/20"
                }`}
            />
          </div>

          {inputError && (
            <p className="text-sm text-rose-400">{inputError}</p>
          )}

          <button
            onClick={handleContinue}
            disabled={!msisdn.trim()}
            className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-slate-950
              disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-400 transition-colors"
          >
            Send verification code →
          </button>
        </div>
      )}

      {/* ── Phase: OTP entry ── */}
      {phase === "OTP_SENT" && (
        <div className="space-y-4">
          {/* Show masked number + back link */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">
              Code sent to{" "}
              <span className="text-slate-200 font-medium">
                {msisdn.slice(0, -4).replace(/./g, "•") + msisdn.slice(-4)}
              </span>
            </span>
            <button
              onClick={handleBack}
              className="text-cyan-400 hover:underline text-xs"
            >
              Change number
            </button>
          </div>

          <OTPSection
            onVerify={handleVerify}
            onResend={handleResend}
            error={otpError}
          />
        </div>
      )}
    </section>
  );
}