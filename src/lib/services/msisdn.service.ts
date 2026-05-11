// src/lib/services/msisdn.service.ts

import registeredUsers from "../../mock/registeredUsers.json";
import { apiGenerateOTP, apiValidateOTP } from "../api/kyc.api";
import { clearOTPTokenFromStorage, createSession } from "./session.service";
import { STORAGE_KEYS, OTP_MAX_ATTEMPTS } from "../constants/kyc.constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckResult = "REGISTERED" | "ELIGIBLE" | "INVALID";

export type OTPResult =
  | { ok: true; token: string; expiresAt: number }
  | {
      ok: false;
      reason: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS";
      message: string;
      // Server-provided remaining attempts — only present on WRONG_CODE.
      // undefined on EXPIRED / MAX_ATTEMPTS (no more attempts are relevant).
      attemptsRemaining?: number;
    };

// ── Internal types ────────────────────────────────────────────────────────────

interface OTPSession {
  msisdn: string;
  expiresAt: number;
  attemptsLeft: number; // client-side mirror — used as a guard before hitting the API
}

interface StoredOTPToken {
  token: string;
  expiresAt: number;
}

// ── Module state ──────────────────────────────────────────────────────────────

const _state: { session: OTPSession | null } = { session: null };

function getActiveSession(): OTPSession | null {
  return _state.session;
}
function setActiveSession(s: OTPSession | null) {
  _state.session = s;
}

// ── Page-load rehydration ─────────────────────────────────────────────────────

function rehydrateSessionFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return;
    const stored = JSON.parse(raw) as StoredOTPToken;
    if (typeof stored.expiresAt === "number" && Date.now() < stored.expiresAt) {
      setActiveSession({
        msisdn: "",
        expiresAt: stored.expiresAt,
        attemptsLeft: OTP_MAX_ATTEMPTS,
      });
    }
  } catch {
    // Corrupted storage — user will need to request a new OTP
  }
}

rehydrateSessionFromStorage();

// ── Validation ────────────────────────────────────────────────────────────────

export function normalizeMSISDN(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\s/g, "");
}

export function isValidE164(msisdn: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(msisdn.trim());
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function saveToken(token: string, expiresAt: number): void {
  localStorage.setItem(
    STORAGE_KEYS.OTP_TOKEN,
    JSON.stringify({ token, expiresAt }),
  );
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredOTPToken;
    if (Date.now() > stored.expiresAt) return null;
    return stored.token;
  } catch {
    return null;
  }
}

// ── Registration check ────────────────────────────────────────────────────────

export function checkMSISDN(msisdn: string): CheckResult {
  if (!isValidE164(msisdn)) return "INVALID";
  const normalized = normalizeMSISDN(msisdn);
  const isRegistered = registeredUsers.some(
    (u) => normalizeMSISDN(u.msisdn) === normalized,
  );
  return isRegistered ? "REGISTERED" : "ELIGIBLE";
}

// ── Generate OTP ──────────────────────────────────────────────────────────────

/**
 * Sends an OTP SMS. Returns the server-provided TTL in seconds so the
 * caller can initialise the OTPSection countdown timer.
 * No token is stored — the user hasn't proved ownership yet.
 */
export async function generateOTP(
  msisdn: string,
  captchaToken: string,
): Promise<number> {
  const normalized = normalizeMSISDN(msisdn);
  const data = await apiGenerateOTP(normalized, captchaToken);

  if (data.StatusCode !== 200 || data.Status !== "successful") {
    throw new Error(
      data.StatusDescription ?? "Failed to send verification code.",
    );
  }

  const validitySeconds = data.Data.OTPValidity;
  const expiresAt = Date.now() + validitySeconds * 1000;

  setActiveSession({
    msisdn: normalized,
    expiresAt,
    attemptsLeft: OTP_MAX_ATTEMPTS,
  });

  return validitySeconds;
}

// ── Timer ─────────────────────────────────────────────────────────────────────

export function getOTPSecondsLeft(): number {
  const session = getActiveSession();
  if (!session) return 0;
  return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

/**
 * Verifies the OTP code against the backend.
 *
 * Attempts tracking:
 *   The client decrements its own counter before the call as a local guard
 *   against hammering the API. The authoritative remaining count comes from
 *   Data.AttemptsRemaining in the backend response and is returned in the
 *   result so the UI always shows the server's value.
 *
 * Token lifecycle:
 *   On success the backend returns a 15-min restricted token. We anchor its
 *   expiry to the server's StatusDate to eliminate client/server clock skew.
 */
export async function verifyOTP(
  msisdn: string,
  otp: string,
  captchaToken: string,
): Promise<OTPResult> {
  const session = getActiveSession();

  const FALLBACK_EXPIRED =
    "Your verification code has expired. Please request a new one.";
  const FALLBACK_MAX =
    "Too many incorrect attempts. Please request a new code.";
  const FALLBACK_WRONG = "Incorrect code — please try again.";

  if (!session) {
    return { ok: false, reason: "EXPIRED", message: FALLBACK_EXPIRED };
  }

  if (Date.now() > session.expiresAt) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED", message: FALLBACK_EXPIRED };
  }

  if (session.attemptsLeft <= 0) {
    setActiveSession(null);
    return { ok: false, reason: "MAX_ATTEMPTS", message: FALLBACK_MAX };
  }

  // Decrement client guard before the call
  setActiveSession({ ...session, attemptsLeft: session.attemptsLeft - 1 });

  const normalized = normalizeMSISDN(msisdn);
  const data = await apiValidateOTP(normalized, otp, captchaToken);

  // ── Type guards for the response Data union ──────────────────────────────
  // data.Data is { Token: {...} } | { AttemptsRemaining: number } | null.
  // TypeScript cannot narrow a union by property access alone, so we use
  // explicit "in" guards before reading either shape.
  const hasToken = data.Data !== null && "Token" in (data.Data ?? {});
  const hasAttempts =
    data.Data !== null && "AttemptsRemaining" in (data.Data ?? {});

  // ── Success ───────────────────────────────────────────────────────────────
  if (data.StatusCode === 200 && data.Status === "successful" && hasToken) {
    const tokenData = (
      data.Data as {
        Token: { TokenType: string; TokenValidity: number; Token: string };
      }
    ).Token;
    const serverTime = new Date(data.StatusDate).getTime();
    const expiresAt = serverTime + tokenData.TokenValidity * 1000;

    saveToken(tokenData.Token, expiresAt);
    createSession({ msisdn: normalized }, expiresAt);
    setActiveSession(null);

    return { ok: true, token: tokenData.Token, expiresAt };
  }

  // ── Failure — read AttemptsRemaining from response body ──────────────────
  const desc = data.StatusDescription ?? "";
  const attemptsRemaining = hasAttempts
    ? (data.Data as { AttemptsRemaining: number }).AttemptsRemaining
    : undefined;

  if (data.StatusCode === 429 || /attempt|limit|max/i.test(desc)) {
    setActiveSession(null);
    return { ok: false, reason: "MAX_ATTEMPTS", message: desc || FALLBACK_MAX };
  }

  if (
    (data.StatusCode === 400 && /not found|expired/i.test(desc)) ||
    data.StatusCode === 401 ||
    /expired/i.test(desc)
  ) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED", message: desc || FALLBACK_EXPIRED };
  }

  // Wrong code — keep session alive, return server's remaining count
  return {
    ok: false,
    reason: "WRONG_CODE",
    message: desc || FALLBACK_WRONG,
    attemptsRemaining,
  };
}

// ── Token access ──────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
  return loadToken();
}

export function isOTPTokenValid(): boolean {
  return loadToken() !== null;
}

// ── Clear ─────────────────────────────────────────────────────────────────────

/** Removes all OTP state. Called from ReviewStep after successful submission. */
export function clearOTP(): void {
  setActiveSession(null);
  clearOTPTokenFromStorage();
}
