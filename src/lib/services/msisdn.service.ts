// src/lib/services/msisdn.service.ts
//
// Handles MSISDN eligibility checks, OTP generation, and OTP verification.
//
// Token lifetime contract:
//   The OTP token persists for exactly OTP_TOKEN_TTL_MS (15 min) from the
//   moment generateOTP() is called, regardless of the server's TokenValidity.
//   It is removed in exactly two places:
//     1. The expiry watcher in session.service (time-based).
//     2. clearOTP() — called from ReviewStep after successful payload submission.
//
//   Notably, a successful verifyOTP() does NOT remove the token — the user
//   still needs it implicitly while completing the remaining steps before submit.

import registeredUsers from "../../mock/registeredUsers.json";
import { apiGenerateOTP, apiValidateOTP } from "../api/kyc.api";
import { clearOTPTokenFromStorage, createSession } from "./session.service";
import { STORAGE_KEYS, OTP_MAX_ATTEMPTS, OTP_TOKEN_TTL_MS } from "../constants/kyc.constants";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CheckResult = "REGISTERED" | "ELIGIBLE" | "INVALID";

export type OTPResult =
  | { ok: true }
  | { ok: false; reason: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS" };

// ── Internal types (not exported — implementation detail) ─────────────────────

interface OTPSession {
  msisdn: string;
  expiresAt: number;
  attemptsLeft: number;
}

interface StoredOTPToken {
  token: string;
  expiresAt: number;
}

// ── Module state ──────────────────────────────────────────────────────────────
// Encapsulated behind get/set so unit tests can inject a fake session without
// reaching into module internals, and so HMR reloads don't silently reset
// state mid-flow in development.

const _state: { session: OTPSession | null } = { session: null };

function getActiveSession(): OTPSession | null {
  return _state.session;
}

function setActiveSession(session: OTPSession | null): void {
  _state.session = session;
}

// ── Page-load rehydration ─────────────────────────────────────────────────────
// Rebuilds the in-memory session from the persisted OTP token so that
// getOTPSecondsLeft() and verifyOTP() survive a full page refresh.
// Called once immediately after definition — not an export, not a hook.

function rehydrateSessionFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return;

    const stored = JSON.parse(raw) as StoredOTPToken;

    if (typeof stored.expiresAt === "number" && Date.now() < stored.expiresAt) {
      setActiveSession({
        msisdn: "",  // not stored in the token — re-supplied by the caller on verify
        expiresAt: stored.expiresAt,
        attemptsLeft: OTP_MAX_ATTEMPTS,
      });
    }
  } catch {
    // Corrupted storage — ignore; the user will need to request a new OTP
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
// Private to this module — callers use the public API only.

function saveToken(token: string, expiresAt: number): void {
  const stored: StoredOTPToken = { token, expiresAt };
  localStorage.setItem(STORAGE_KEYS.OTP_TOKEN, JSON.stringify(stored));
}

function loadToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return null;

    const stored = JSON.parse(raw) as StoredOTPToken;

    if (Date.now() > stored.expiresAt) {
      // Expired — the watcher will clean this up; we just return null here
      return null;
    }

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
 * Calls the generate-OTP API, persists the returned token, creates a KYC
 * session anchored to the same expiresAt, and initialises the in-memory
 * attempt counter.
 *
 * Token TTL: always OTP_TOKEN_TTL_MS (15 min) from Date.now() — the server's
 * TokenValidity is used only to validate the OTP itself, not to set our timer.
 *
 * Throws if the API returns a non-successful status so the caller can show
 * an appropriate error message.
 */
export async function generateOTP(msisdn: string): Promise<void> {
  const normalized = normalizeMSISDN(msisdn);
  const data = await apiGenerateOTP(normalized);

  if (data.StatusCode !== 200 || data.Status !== "successful") {
    throw new Error(data.StatusDescription ?? "OTP generation failed");
  }

  const token     = data.Data.Token.Token;
  const expiresAt = Date.now() + OTP_TOKEN_TTL_MS; // fixed 15-min window

  // 1. Persist the token with the fixed expiry — survives a page refresh
  saveToken(token, expiresAt);

  // 2. Create (or replace) the KYC session anchored to the same expiresAt.
  //    Both the session and the token expire at exactly the same moment.
  createSession({ msisdn: normalized }, expiresAt);

  // 3. Initialise the in-memory session for this tab
  setActiveSession({ msisdn: normalized, expiresAt, attemptsLeft: OTP_MAX_ATTEMPTS });
}

// ── Timer ─────────────────────────────────────────────────────────────────────

/** Returns the number of whole seconds remaining in the 15-min OTP window. */
export function getOTPSecondsLeft(): number {
  const session = getActiveSession();
  if (!session) return 0;
  return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
}

// ── Token validity ───────────────────────────────────────────────────────────

/**
 * Returns true if the OTP token exists in storage and has not yet expired.
 *
 * Reads directly from localStorage rather than activeSession so it stays
 * accurate after a page refresh (activeSession is null post-verify, but the
 * token is still valid and the user should be able to continue the flow).
 *
 * Used by useKYCFlow.nextStep() to gate step progression.
 */
export function isOTPTokenValid(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { expiresAt: number };
    return typeof stored.expiresAt === "number" && Date.now() < stored.expiresAt;
  } catch {
    return false;
  }
}

// ── Attempts ──────────────────────────────────────────────────────────────────

/**
 * Returns how many verification attempts remain for the current OTP.
 * Tracked client-side until the backend exposes this in its response.
 */
export function getOTPAttemptsLeft(): number {
  return getActiveSession()?.attemptsLeft ?? 0;
}

// ── Verify OTP ────────────────────────────────────────────────────────────────

/**
 * Verifies the supplied OTP code against the backend.
 *
 * Token persistence:
 *   A successful verify does NOT remove the token. The token must remain
 *   available for the rest of the flow until the payload is submitted.
 *   Only clearOTP() (called from ReviewStep on submit) removes it.
 *
 * Attempt tracking:
 *   The counter is decremented before the API call so that a network error
 *   still counts as an attempt (prevents hammering the API on retries).
 *
 * Error classification:
 *   StatusCode is checked first (reliable). StatusDescription regex is a
 *   fallback only.
 *
 * TODO: replace description fallback with explicit StatusCode values
 * once the backend team documents them (tracked in JIRA-XXX).
 */
export async function verifyOTP(
  msisdn: string,
  otp: string,
): Promise<OTPResult> {
  const session = getActiveSession();

  // Guard: no active session
  if (!session) {
    return { ok: false, reason: "EXPIRED" };
  }

  // Guard: 15-min window has closed
  if (Date.now() > session.expiresAt) {
    setActiveSession(null); // token stays — watcher will remove it at expiry
    return { ok: false, reason: "EXPIRED" };
  }

  // Guard: no valid token in storage (already expired or corrupted)
  const token = loadToken();
  if (!token) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED" };
  }

  // Guard: client-side attempt limit
  if (session.attemptsLeft <= 0) {
    setActiveSession(null); // token stays until expiry or submit
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  // Decrement before the call — a network error still consumes an attempt
  setActiveSession({ ...session, attemptsLeft: session.attemptsLeft - 1 });

  const normalized = normalizeMSISDN(msisdn);
  const data = await apiValidateOTP(normalized, otp, token);

  // ── Success — clear the in-memory session only, token stays ───────────────
  if (data.StatusCode === 200 && data.Status === "successful") {
    setActiveSession(null);
    return { ok: true };
  }

  // ── Failure — classify by StatusCode first, description as fallback ───────
  const desc = (data.StatusDescription ?? "").toLowerCase();

  if (data.StatusCode === 401 || /expired/i.test(desc)) {
    setActiveSession(null); // token stays — watcher handles cleanup
    return { ok: false, reason: "EXPIRED" };
  }

  if (data.StatusCode === 429 || /attempt|limit|max/i.test(desc)) {
    setActiveSession(null); // token stays — watcher handles cleanup
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  // Unexpected API shape — log for debugging but don't expose internals
  if (data.StatusCode === undefined) {
    console.error("[msisdn.service] verifyOTP: unexpected API response shape", data);
  }

  return { ok: false, reason: "WRONG_CODE" };
}

// ── Clear ─────────────────────────────────────────────────────────────────────

/**
 * Removes all OTP state — both the in-memory session and the persisted token.
 * Called ONLY from ReviewStep after the payload has been successfully submitted.
 * Do not call this on verify success or on error — the token must persist.
 */
export function clearOTP(): void {
  setActiveSession(null);
  clearOTPTokenFromStorage();
}