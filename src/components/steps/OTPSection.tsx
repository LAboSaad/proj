import { useEffect, useRef, useState } from "react";
import { getOTPAttemptsLeft } from "../../lib/services/msisdn.service";

interface OTPSectionProps {
  onVerify: (code: string) => void;
  onResend: () => Promise<number>; // returns fresh TokenValidity seconds
  error: string;
  loading?: boolean;
  initialSeconds: number; // server-provided TTL on first render
}

const OTP_LENGTH = 5;

export default function OTPSection({
  onVerify,
  onResend,
  error,
  loading = false,
  initialSeconds,
}: OTPSectionProps) {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [secondsLeft, setSeconds] = useState(initialSeconds);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const tickRef = useRef<number | null>(null);

  const startTick = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(tickRef.current!);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Start the countdown once on mount using the server-provided initialSeconds
  useEffect(() => {
    setSeconds(initialSeconds);
    setCanResend(false);
    startTick();
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      const code = digits.join("");
      if (code.length === OTP_LENGTH) handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = () => {
    const code = digits.join("");
    if (code.length < OTP_LENGTH || loading) return;
    onVerify(code);
    setDigits(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
  };

  const handleResend = async () => {
    setDigits(Array(OTP_LENGTH).fill(""));
    setCanResend(false);
    // onResend calls generateOTP which returns fresh TokenValidity seconds
    const freshSeconds = await onResend();
    setSeconds(freshSeconds);
    startTick();
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const attemptsLeft = getOTPAttemptsLeft();
  const filled = digits.every(Boolean);
  const isUrgent = secondsLeft < 30 && secondsLeft > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm">
        <p className="text-slate-400">Enter the 5-digit code.</p>
        {!canResend && (
          <span
            className={`tabular-nums font-medium transition-colors ${isUrgent ? "text-rose-400" : "text-slate-400"}`}
          >
            {isUrgent && <span className="mr-1">⏱</span>}
            {mm}:{ss}
          </span>
        )}
      </div>

      <div className="flex gap-2 justify-center">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            value={d}
            maxLength={1}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={loading}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className={`w-11 h-14 rounded-xl text-center text-xl font-bold bg-slate-900
              border transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed
              ${
                error
                  ? "border-rose-500 text-rose-300"
                  : d
                    ? "border-cyan-500 text-cyan-200"
                    : "border-slate-700 text-slate-100"
              }
              focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-400 text-center">
          <span>⚠ </span>
          {error}
          {attemptsLeft > 0 && error.includes("incorrect") && (
            <span className="ml-1 text-slate-500">
              ({attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} left)
            </span>
          )}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!filled || loading}
        className="w-full rounded-2xl bg-cyan-500 py-3 font-semibold text-slate-950
          disabled:cursor-not-allowed disabled:opacity-40 hover:bg-cyan-400
          transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
            Verifying…
          </>
        ) : (
          "Verify Code"
        )}
      </button>

      <p className="text-center text-sm text-slate-500">
        {canResend ? (
          <>
            Didn't receive it?{" "}
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-cyan-400 hover:text-cyan-300 hover:underline
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Resend code
            </button>
          </>
        ) : (
          "Didn't receive it? Wait for the timer to resend."
        )}
      </p>
    </div>
  );
}
