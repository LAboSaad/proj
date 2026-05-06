
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

export const STORAGE_KEYS = {
  SESSION: "kyc_session",

  OTP_TOKEN: "kyc_otp_token",
} as const;

// ── OTP config ────────────────────────────────────────────────────────────────

export const OTP_MAX_ATTEMPTS = 3;

// ── Field / session defaults ──────────────────────────────────────────────────

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
  fields: initialFields,
  mrzValid: null,
  mrzMessage: "",
  faceMatch: null,
};
