// src/lib/constants/kyc.constants.ts
//
// All compile-time constants for the KYC flow.
// Absorbs what was previously kyc-storage.constants.ts — no separate file needed.
//
// Rules:
//   • Imports types from kyc.types ONLY — never from services.
//   • No logic, no functions — pure data.

import type { Step, ExtractedFields, KYCSession } from "../../types/kyc";

// ── Flow steps ────────────────────────────────────────────────────────────────

export const steps: Step[] = [
  { key: "msisdn", label: "Mobile Number" },
  { key: "consent", label: "Consent" },
  { key: "selfie", label: "Selfie & Liveness" },
  { key: "document", label: "Document Capture" },
  { key: "ocr", label: "OCR & MRZ" },
  { key: "match", label: "Face Match" },
  { key: "review", label: "Review Payload" },
];

// ── Camera constraints ────────────────────────────────────────────────────────

export const videoConstraints: MediaTrackConstraints = {
  width: 720,
  height: 540,
  facingMode: "user",
};

export const docVideoConstraints: MediaTrackConstraints = {
  facingMode: "environment",
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

// ── Storage keys ──────────────────────────────────────────────────────────────
// Single source of truth — imported by session.service and msisdn.service.
// Changing a key here is the only change needed.

export const STORAGE_KEYS = {
  /** Full KYC session — step progress, images, OCR fields, etc. */
  SESSION: "kyc_session",

  /** OTP token returned by the generate-OTP API. Persists for OTP_TOKEN_TTL_MS. */
  OTP_TOKEN: "kyc_otp_token",
} as const;

// ── OTP config ────────────────────────────────────────────────────────────────

/**
 * Maximum OTP verification attempts enforced client-side.
 * Update when the backend starts returning a remaining-attempts field.
 */
export const OTP_MAX_ATTEMPTS = 3;

/**
 * Fixed client-side TTL for the OTP token — 15 minutes from generation.
 *
 * We intentionally ignore the server's TokenValidity value and anchor the
 * token lifetime to this constant instead, for two reasons:
 *   1. The token must outlive a successful OTP verify — it stays alive until
 *      the final payload is submitted (or the 15 min window closes).
 *   2. It gives us a single, predictable number to reason about in the UI
 *      (countdown timer, session watcher, expiry guards).
 *
 * The token is removed in exactly two places:
 *   • The expiry watcher in session.service — when Date.now() > expiresAt.
 *   • clearOTP() in msisdn.service — called only from the submit action in
 *     ReviewStep after the payload has been successfully sent.
 */
// export const OTP_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Field / session defaults ──────────────────────────────────────────────────
// `initialFields` is the canonical empty ExtractedFields object.
// Previously duplicated as EMPTY_FIELDS in a separate constants file — removed.

export const initialFields: ExtractedFields = {
  FirstName: "",
  MiddleName: "",
  LastName: "",
  Email: "",
  Address: "",
  IdDocSerialNumber: "",
  Nationality: "",
  BirthDate: "",
  ExpiryDate: "",
  Gender: "",
  rawMRZ: "",
  rawOCRText: "",
};

export const SESSION_DEFAULTS: Omit<KYCSession, "expiresAt"> = {
  stepKey: "msisdn",
  msisdn: "",
  agreed: false,
  selfieImage: "",
  faceSidePhoto: "",
  documentImage: "",
  documentBackImage: "",
  documentQuality: null,
  documentBackQuality: null,
  fields: initialFields, // reuse — not a second copy
  mrzValid: null,
  mrzMessage: "",
  faceMatch: null,
};
