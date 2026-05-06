// src/lib/services/msisdn.service.ts

import registeredUsers from "../../mock/registeredUsers.json";
import { apiGenerateOTP, apiValidateOTP } from "../api/kyc.api";
import { clearOTPTokenFromStorage, createSession } from "./session.service";
import { STORAGE_KEYS, OTP_MAX_ATTEMPTS } from "../constants/kyc.constants";

export type CheckResult = "REGISTERED" | "ELIGIBLE" | "INVALID";

export type OTPResult =
  | { ok: true }
  | { ok: false; reason: "WRONG_CODE" | "EXPIRED" | "MAX_ATTEMPTS" };

interface OTPSession {
  msisdn: string;
  expiresAt: number;
  attemptsLeft: number;
}

interface StoredOTPToken {
  token: string;
  expiresAt: number;
}

const _state: { session: OTPSession | null } = { session: null };

function getActiveSession(): OTPSession | null {
  return _state.session;
}

function setActiveSession(session: OTPSession | null): void {
  _state.session = session;
}

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
    // Corrupted storage — ignore
  }
}

rehydrateSessionFromStorage();

export function normalizeMSISDN(raw: string): string {
  return raw.replace(/^\+/, "").replace(/\s/g, "");
}

export function isValidE164(msisdn: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(msisdn.trim());
}

function saveToken(token: string, expiresAt: number): void {
  const stored: StoredOTPToken = { token, expiresAt };
  localStorage.setItem(STORAGE_KEYS.OTP_TOKEN, JSON.stringify(stored));
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

export function checkMSISDN(msisdn: string): CheckResult {
  if (!isValidE164(msisdn)) return "INVALID";
  const normalized = normalizeMSISDN(msisdn);
  const isRegistered = registeredUsers.some(
    (u) => normalizeMSISDN(u.msisdn) === normalized,
  );
  return isRegistered ? "REGISTERED" : "ELIGIBLE";
}

/**
 * Calls the generate-OTP API, persists the returned token, and returns
 * TokenValidity (in seconds) so the UI can initialise its countdown
 * directly from the server-provided value.
 */
export async function generateOTP(msisdn: string): Promise<number> {
  const normalized = normalizeMSISDN(msisdn);
  const data = await apiGenerateOTP(normalized);

  if (data.StatusCode !== 200 || data.Status !== "successful") {
    throw new Error(data.StatusDescription ?? "OTP generation failed");
  }

  const token = data.Data.Token.Token;
  const validityMs = data.Data.Token.TokenValidity * 1000; // server seconds → ms
  const expiresAt = Date.now() + validityMs;

  saveToken(token, expiresAt);
  createSession({ msisdn: normalized }, expiresAt);
  setActiveSession({
    msisdn: normalized,
    expiresAt,
    attemptsLeft: OTP_MAX_ATTEMPTS,
  });

  return data.Data.Token.TokenValidity; // return raw seconds to the caller
}

export function getOTPSecondsLeft(): number {
  const session = getActiveSession();
  if (!session) return 0;
  return Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
}

export function isOTPTokenValid(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { expiresAt: number };
    return (
      typeof stored.expiresAt === "number" && Date.now() < stored.expiresAt
    );
  } catch {
    return false;
  }
}

export function getOTPAttemptsLeft(): number {
  return getActiveSession()?.attemptsLeft ?? 0;
}

export async function verifyOTP(
  msisdn: string,
  otp: string,
): Promise<OTPResult> {
  const session = getActiveSession();

  if (!session) return { ok: false, reason: "EXPIRED" };

  if (Date.now() > session.expiresAt) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED" };
  }

  const token = loadToken();
  if (!token) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED" };
  }

  if (session.attemptsLeft <= 0) {
    setActiveSession(null);
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  setActiveSession({ ...session, attemptsLeft: session.attemptsLeft - 1 });

  const normalized = normalizeMSISDN(msisdn);
  const data = await apiValidateOTP(normalized, otp, token);

  if (data.StatusCode === 200 && data.Status === "successful") {
    setActiveSession(null);
    return { ok: true };
  }

  const desc = (data.StatusDescription ?? "").toLowerCase();

  if (data.StatusCode === 401 || /expired/i.test(desc)) {
    setActiveSession(null);
    return { ok: false, reason: "EXPIRED" };
  }

  if (data.StatusCode === 429 || /attempt|limit|max/i.test(desc)) {
    setActiveSession(null);
    return { ok: false, reason: "MAX_ATTEMPTS" };
  }

  if (data.StatusCode === undefined) {
    console.error(
      "[msisdn.service] verifyOTP: unexpected API response shape",
      data,
    );
  }

  return { ok: false, reason: "WRONG_CODE" };
}

export function clearOTP(): void {
  setActiveSession(null);
  clearOTPTokenFromStorage();
}
