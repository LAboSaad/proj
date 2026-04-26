import { useEffect, useRef, useState } from "react";
import { getOTPSecondsLeft, getOTPAttemptsLeft } from "../../lib/services/msisdn.service";

interface OTPSectionProps {
  onVerify: (code: string) => void;
  onResend: () => void;
  error: string;
}

const OTP_LENGTH = 6;

export default function OTPSection({ onVerify, onResend, error }: OTPSectionProps) {
  const [digits, setDigits]       = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSeconds] = useState(() => getOTPSecondsLeft());
  const [canResend, setCanResend] = useState(false);
  const inputRefs                 = useRef<(HTMLInputElement | null)[]>([]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    setSeconds(getOTPSecondsLeft());
    setCanResend(false);

    const tick = window.setInterval(() => {
      const left = getOTPSecondsLeft();
      setSeconds(left);
      if (left === 0) {
        setCanResend(true);
        window.clearInterval(tick);
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, []);

  // ── Digit input handlers ───────────────────────────────────────────────────
  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1); // only last digit
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    // focus last filled or next empty
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = () => {
    const code = digits.join("");
    if (code.length < OTP_LENGTH) return;
    onVerify(code);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const handleResend = () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    setCanResend(false);
    onResend();
    // reset timer display — effect will re-run via key if needed
    setSeconds(120);
    const tick = window.setInterval(() => {
      const left = getOTPSecondsLeft();
      setSeconds(left);
      if (left === 0) {
        setCanResend(true);
        window.clearInterval(tick);
      }
    }, 1000);
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const attemptsLeft = getOTPAttemptsLeft();
  const filled = digits.every(Boolean);

  return (
    <div className="space-y-5">

      {/* Instructional label */}
      <p className="text-sm text-slate-400">
        Enter the 6-digit code sent to your number.
        {!canResend && (
          <span className="ml-1 tabular-nums text-slate-500">
            Code expires in{" "}
            <span className={secondsLeft < 30 ? "text-rose-400" : "text-slate-300"}>
              {mm}:{ss}
            </span>
          </span>
        )}
      </p>

      {/* 6 digit boxes */}
      <div className="flex gap-2 justify-center">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            value={d}
            maxLength={1}
            inputMode="numeric"
            autoComplete="one-time-code"
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`w-11 h-14 rounded-xl text-center text-xl font-bold bg-slate-900 border transition-all outline-none
              ${error
                ? "border-rose-500 text-rose-300"
                : d
                ? "border-cyan-500 text-cyan-200"
                : "border-slate-700 text-slate-100"
              }
              focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-rose-400 text-center">
          {error}
          {attemptsLeft > 0 && error.includes("incorrect") && (
            <span className="ml-1 text-slate-500">({attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} left)</span>
          )}
        </p>
      )}

      {/* Verify button */}
      <button
        onClick={handleSubmit}
        disabled={!filled}
        className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-slate-950
          disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-400 transition-colors"
      >
        Verify Code
      </button>

      {/* Resend */}
      <p className="text-center text-sm text-slate-500">
        {canResend ? (
          <button onClick={handleResend} className="text-cyan-400 hover:underline">
            Resend code
          </button>
        ) : (
          "Didn't receive it? Wait for the timer to resend."
        )}
      </p>
    </div>
  );
}