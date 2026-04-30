// src/lib/constants/kyc.constants.ts
import type { ExtractedFields, Step } from "../../types/kyc";

export const steps: Step[] = [
   { key: "msisdn", label: "Mobile Number" },
  { key: "consent", label: "Consent" },
  { key: "selfie", label: "Selfie & Liveness" },
  { key: "document", label: "Document Capture" },
  { key: "ocr", label: "OCR & MRZ" },
  { key: "match", label: "Face Match" },
  { key: "review", label: "Review Payload" },
];

export const videoConstraints: MediaTrackConstraints = {
  width: 720,
  height: 540,
  facingMode: "user",
};

export const docVideoConstraints = {
  facingMode: "environment",
  width: { ideal: 1920 },
  height: { ideal: 1080 },
};

export const initialFields: ExtractedFields = {
  FirstName: "",
  MiddleName:"",
  LastName: "",
  Email:"",
  Address:"",
  IdDocSerialNumber: "",
  Nationality: "",
  BirthDate: "",
  ExpiryDate: "",
  Gender: "",
  rawMRZ: "",
  rawOCRText: "",
};

export type LivenessChallenge =
  | "center"
  | "lookLeft"
  | "lookRight"
  | "raiseLeftHand"
  | "raiseRightHand"
  | "nodHead"
  | "moveCloser"

export type LandmarkStatus = {
  faceDetected: boolean;
  yawEstimate: number;
  qualityOk: boolean;
  hint: string;
};

export type FaceMatchResult = {
  distance: number;
  similarity: number;
  threshold: number;
  passed: boolean;
  status: "pass" | "review";
};

export type ChallengeConfig = {
  id: LivenessChallenge;
  label: string;
  instruction: string;
  icon: string;
  requiresHand: boolean;
  requiresPose: boolean;
};