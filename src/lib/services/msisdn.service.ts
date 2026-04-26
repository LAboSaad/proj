import registeredUsers from "../../mock/registeredUsers.json";

// ── Types ──────────────────────────────────────────────────────────────────

export type CheckResult = "REGISTERED" | "ELIGIBLE" | "INVALID";

export type OTPResult =
  | { ok: true }
  | { ok: false; reason: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS" };

// ── Internal OTP store (in-memory mock — replace with backend call) ─────────

interface OTPRecord {
  code: string;
  expiresAt: number;   // epoch ms
  attempts: number;
}

const OTP_TTL_MS      = 2 * 60 * 1000; // 2 minutes
const MAX_OTP_ATTEMPTS = 3;

// Single active OTP slot (one session at a time in this mock)
let activeOTP: OTPRecord | null = null;

// ── Normalisation ──────────────────────────────────────────────────────────

/**
 * Strip leading + and whitespace, return digits only.
 * "+243 97 000 0001" → "2439700000001"
 */
export function normalizeMSISDN(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\s/g, "");
}

/**
 * Loose E.164 check: optional leading +, then 7–15 digits, first digit non-zero.
 */
export function isValidE164(msisdn: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(msisdn.trim());
}

// ── Check registration ─────────────────────────────────────────────────────

export function checkMSISDN(msisdn: string): CheckResult {
  if (!isValidE164(msisdn)) return "INVALID";

  const normalized = normalizeMSISDN(msisdn);

  const exists = registeredUsers.some(
    (u) => normalizeMSISDN(u.msisdn) === normalized
  );

  return exists ? "REGISTERED" : "ELIGIBLE";
}

// ── OTP lifecycle ──────────────────────────────────────────────────────────

/** Generate and store a new OTP. Returns the code (log / send via SMS). */
export function generateOTP(): string {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  activeOTP = {
    code,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  // 🔥 In production: send SMS here instead of console.log
  console.log("📩 Mock OTP:", code);
  return code;
}

/** Seconds remaining on the active OTP (0 if none / expired). */
export function getOTPSecondsLeft(): number {
  if (!activeOTP) return 0;
  return Math.max(0, Math.ceil((activeOTP.expiresAt - Date.now()) / 1000));
}

/** Verify the user-supplied code against the stored OTP. */
export function verifyOTP(input: string): OTPResult {
  if (!activeOTP) return { ok: false, reason: "EXPIRED" };

  if (Date.now() > activeOTP.expiresAt) {
    activeOTP = null;
    return { ok: false, reason: "EXPIRED" };
  }

  if (activeOTP.attempts >= MAX_OTP_ATTEMPTS) {
    activeOTP = null;
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  activeOTP.attempts += 1;

  if (input.trim() === activeOTP.code) {
    activeOTP = null;
    return { ok: true };
  }

  if (activeOTP.attempts >= MAX_OTP_ATTEMPTS) {
    activeOTP = null;
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  return { ok: false, reason: "WRONG_CODE" };
}

/** How many attempts remain on the active OTP. */
export function getOTPAttemptsLeft(): number {
  if (!activeOTP) return 0;
  return Math.max(0, MAX_OTP_ATTEMPTS - activeOTP.attempts);
}

/** Invalidate the current OTP (e.g. on resend). */
export function clearOTP(): void {
  activeOTP = null;
}