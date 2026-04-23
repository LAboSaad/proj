import type { SubmissionPayload } from "../types/kyc";


export function buildPayload(args: any): SubmissionPayload {
  return {
    ...args,
    capturedAt: new Date().toISOString(),
    readyForBackendPost: Boolean(
      args.consentAccepted &&
      args.selfieImage &&
      args.documentImage &&
      args.livenessDone &&
      args.fields?.rawOCRText
    ),
  };
}