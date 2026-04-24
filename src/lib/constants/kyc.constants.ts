import type { ExtractedFields, Step } from "../../types/kyc";

export 
const steps: Step[] = [
  //  { key: "msisdn", label: "Mobile Number" },
  // { key: "consent", label: "Consent" },
  // { key: "selfie", label: "Selfie & Liveness" },
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
  firstName: "",
  lastName: "",
  documentNumber: "",
  nationality: "",
  birthDate: "",
  expiryDate: "",
  sex: "",
  rawMRZ: "",
  rawOCRText: "",
};