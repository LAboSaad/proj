import registeredUsers from "../../mock/registeredUsers.json";
import { apiGenerateOTP, apiValidateOTP } from "../api/kyc.api";

// ── Types ──────────────────────────────────────────────────────────────────

export type CheckResult = "REGISTERED" | "ELIGIBLE" | "INVALID";

export type OTPResult =
  | { ok: true }
  | { ok: false; reason: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS" };

// ── Constants ──────────────────────────────────────────────────────────────

const TOKEN_STORAGE_KEY = "kyc_otp_token";

// ── OTP session (memory only for expiry) ───────────────────────────────────

interface OTPSession {
  msisdn: string;
  expiresAt: number;
}

let activeSession: OTPSession | null = null;

// ── Utils ─────────────────────────────────────────────────────────────────

export function normalizeMSISDN(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\s/g, "");
}

export function isValidE164(msisdn: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(msisdn.trim());
}

// ── Storage helpers (ONLY TOKEN STRING) ────────────────────────────────────

function saveToken(token: string): void {
  console.log("💾 Saving token (string only)");
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function loadToken(): string | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);

  console.log("📦 Loaded token:", token);

  return token;
}

function removeToken(): void {
  console.log("🧹 Removing token");
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// ── Registration check ─────────────────────────────────────────────────────

export function checkMSISDN(msisdn: string): CheckResult {
  if (!isValidE164(msisdn)) return "INVALID";

  const normalized = normalizeMSISDN(msisdn);
  const exists = registeredUsers.some(
    (u) => normalizeMSISDN(u.msisdn) === normalized
  );

  return exists ? "REGISTERED" : "ELIGIBLE";
}

// ── Generate OTP ───────────────────────────────────────────────────────────

export async function generateOTP(msisdn: string): Promise<void> {
  const normalized = normalizeMSISDN(msisdn);
  const data = await apiGenerateOTP(normalized);

  if (data.StatusCode !== 200 || data.Status !== "successful") {
    throw new Error(data.StatusDescription ?? "OTP generation failed");
  }

  const token = data.Data.Token.Token;
  const ttlMs = data.Data.Token.TokenValidity * 1000;

  const serverTime = new Date(data.StatusDate).getTime();
  const expiresAt = serverTime + ttlMs;

  console.log("🧠 expiresAt:", new Date(expiresAt).toString());

  // ✅ Save ONLY token
  saveToken(token);

  // ✅ Keep expiry ONLY in memory
  activeSession = {
    msisdn: normalized,
    expiresAt,
  };
}

// ── Timer ──────────────────────────────────────────────────────────────────

export function getOTPSecondsLeft(): number {
  if (!activeSession) return 0;

  return Math.max(
    0,
    Math.ceil((activeSession.expiresAt - Date.now()) / 1000)
  );
}

// ── Attempts ───────────────────────────────────────────────────────────────

export function getOTPAttemptsLeft(): number {
  return activeSession ? 3 : 0;
}

// ── Verify OTP ─────────────────────────────────────────────────────────────

export async function verifyOTP(
  msisdn: string,
  otp: string
): Promise<OTPResult> {
  if (!activeSession) {
    return { ok: false, reason: "EXPIRED" };
  }

  if (Date.now() > activeSession.expiresAt) {
    activeSession = null;
    removeToken();
    return { ok: false, reason: "EXPIRED" };
  }

  const token = loadToken();
  if (!token) {
    activeSession = null;
    return { ok: false, reason: "EXPIRED" };
  }

  const normalized = normalizeMSISDN(msisdn);
  const data = await apiValidateOTP(normalized, otp, token);

  if (data.StatusCode === 200 && data.Status === "successful") {
    console.log("✅ OTP verified");
    // activeSession = null;
    // removeToken();
    return { ok: true };
  }

  const desc = data.StatusDescription ?? "";

  if (/expired/i.test(desc)) {
    activeSession = null;
    removeToken();
    return { ok: false, reason: "EXPIRED" };
  }

  if (/attempt|limit|max/i.test(desc)) {
    activeSession = null;
    removeToken();
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  return { ok: false, reason: "WRONG_CODE" };
}

// ── Clear session ──────────────────────────────────────────────────────────

export function clearOTP(): void {
  activeSession = null;
  removeToken();
}