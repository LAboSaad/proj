import type {
  DocumentQuality,
  ExtractedFields,
  FaceMatchResult,
  SubmissionPayload,
} from "../../types/kyc";
import type { LivenessChallenge } from "../constants/kyc.constants";

export function buildPayload(args: {
  consentAccepted: boolean;
  selfieImage: string;
  documentImage: string;
  livenessDone: boolean;
  livenessCompleted: Record<LivenessChallenge, boolean>;
  finalYawEstimate: number;
  documentQuality: DocumentQuality | null;
  fields: ExtractedFields;
  mrzValid: boolean | null;
  mrzMessage: string;
  faceMatch: FaceMatchResult | null;
}): SubmissionPayload {
  const {
    consentAccepted,
    selfieImage,
    documentImage,
    livenessDone,
    livenessCompleted,
    finalYawEstimate,
    documentQuality,
    fields,
    mrzValid,
    mrzMessage,
    faceMatch,
  } = args;

  const readyForBackendPost = Boolean(
    consentAccepted &&
      selfieImage &&
      documentImage &&
      livenessDone &&
      fields.rawOCRText &&
      faceMatch &&
      documentQuality?.looksUsefulForOCR
  );

  return {
    consentAccepted,
    capturedAt: new Date().toISOString(),
    images: {
      selfie: selfieImage,
      document: documentImage,
    },
    liveness: {
      completed: livenessDone,
      completedChallenges: livenessCompleted,
      finalYawEstimate,
    },
    documentQuality,
    ocr: fields,
    mrz: {
      valid: mrzValid,
      message: mrzMessage,
    },
    faceMatch,
    readyForBackendPost,
  };
}