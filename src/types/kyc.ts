import type { LivenessChallenge } from "../lib/constants/kyc.constants";

export type StepKey =
  | "msisdn"
  | "consent"
  | "selfie"
  | "document"
  | "ocr"
  | "match"
  | "review";

export type Step = {
  key: StepKey;
  label: string;
};

// export type LivenessChallenge = "center" | "lookLeft" | "lookRight";

export type AppError = {
  scope: string;
  message: string;
};

export type ExtractedFields = {
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Email: string;
  Address: string;
  IdDocSerialNumber: string;
  Nationality: string;
  BirthDate: string;
  ExpiryDate: string;
  Gender: string;
  rawMRZ: string;
  rawOCRText: string;
};

export type FaceMatchResult = {
  distance: number;
  similarity: number;
  threshold: number;
  passed: boolean;
  status: "pass" | "review";
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};
 
export type LandmarkStatus = {
  faceDetected: boolean;
  yawEstimate: number;
  qualityOk: boolean;
  hint: string;
  faceBox: FaceBox | null; // bounding box in VIDEO pixel space (from face-api.js)
};

export type DocumentQuality = {
  width: number;
  height: number;
  brightness: number;
  contrast: number;
  blurScore: number;
  edgeDensity: number;
  aspectRatio: number;
  glareRatio: number;
  looksSharpEnough: boolean;
  looksBrightEnough: boolean;
  looksLowGlare: boolean;
  looksUsefulForOCR: boolean;
  reasons: string[];
};

export type OcrRunResult = {
  rawOCRText: string;
  rawMRZ: string;
  mrzValid: boolean;
  mrzMessage: string;
  fields: ExtractedFields;
};

export type SubmissionPayload = {
  consentAccepted: boolean;
  capturedAt: string;
  images: {
    selfie: string;
    FaceSidePhoto_b64: string;
    IdDocFontPhoto_b64: string;
    IdDocRearPhoto_b64: string;
  };
  liveness: {
    completed: boolean;
    completedChallenges: Record<LivenessChallenge, boolean>;
    finalYawEstimate: number;
  };
  documentQuality: DocumentQuality | null;
  ocr: ExtractedFields;
  mrz: {
    valid: boolean | null;
    message: string;
  };
  faceMatch: FaceMatchResult | null;
  readyForBackendPost: boolean;
};
