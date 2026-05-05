import type { KYCSession, SessionPatch } from "../../types/kyc";
import { STORAGE_KEYS, SESSION_DEFAULTS } from "../constants/kyc.constants";
export type { KYCSession, SessionPatch };

// ── KYC Session ───────────────────────────────────────────────────────────────

/**
 * Returns the current session if it exists and has not expired.
 * Automatically clears an expired session so callers never receive stale data.
 */
export function loadSession(): KYCSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;

    const session = JSON.parse(raw) as KYCSession;

    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }

    return session;
  } catch {
    // Corrupted JSON — clear and start fresh
    clearSession();
    return null;
  }
}

/**
 * Creates a brand-new KYC session anchored to the given expiresAt.
 *
 * Always wipes any existing session first so the expiry is never inherited
 * from a previous flow. Called once from generateOTP() so the session and
 * OTP token share an identical birth moment and TTL.
 */
export function createSession(patch: SessionPatch, expiresAt: number): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);

    const next: KYCSession = {
      ...SESSION_DEFAULTS,
      ...patch,
      expiresAt,
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(next));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently.
    // The flow still works; the session just won't survive a page refresh.
  }
}

/**
 * Merges a partial update into the existing session without touching expiresAt.
 *
 * If no session exists yet (e.g. called before generateOTP has run) this is a
 * deliberate no-op — we must never create a session with a missing or wrong
 * expiresAt, because that would break the shared-TTL contract with the OTP token.
 */
export function saveSession(patch: SessionPatch): void {
  try {
    const existing = loadSession();
    if (!existing) return;

    const next: KYCSession = {
      ...existing,
      ...patch,
      expiresAt: existing.expiresAt, // immutable — set only by createSession
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(next));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently.
  }
}

/** Removes the session from localStorage unconditionally. */
export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ── OTP token ─────
// Full OTP token logic lives in msisdn.service.
// These helpers exist only so startExpiryWatcher() can clear the token
// without importing msisdn.service (which would create a circular dependency).

export function clearOTPTokenFromStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.OTP_TOKEN);
}

/**
 * Returns the OTP token's expiresAt timestamp, or null if absent / expired.
 * Used only by the expiry watcher and useSessionTimers.
 */
export function getOTPTokenExpiry(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { token: string; expiresAt: number };

    if (typeof parsed?.expiresAt !== "number") return null;

    return parsed.expiresAt;
  } catch {
    return null;
  }
}

// ── Expiry watcher ────────────────────────────────────────────────────────────

export function startExpiryWatcher(): () => void {
  function runChecks(): void {
    // Session — loadSession() handles its own cleanup when expired
    loadSession();

    // OTP token — clear independently of the in-memory activeSession
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.OTP_TOKEN);
      if (!raw) return;

      const stored = JSON.parse(raw) as { token: string; expiresAt: number };

      if (Date.now() > stored.expiresAt) {
        clearOTPTokenFromStorage();
      }
    } catch {
      // Corrupted token — remove it
      clearOTPTokenFromStorage();
    }
  }

  // Run immediately so an already-expired session is cleared before first render
  runChecks();

  const intervalId = window.setInterval(runChecks, 60_000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") runChecks();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}
