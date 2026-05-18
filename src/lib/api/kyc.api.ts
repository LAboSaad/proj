// src/lib/api/kyc.api.ts

import axios from "axios";
import { ENV } from "../config/env";

const kycApi = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  validateStatus: () => true,
});

// ── Response types ────────────────────────────────────────────────────────────

export interface GenerateOTPResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  StatusDate: string;
  Data: {
    OTP: string;
    OTPValidity: number;
  };
}

export interface ValidateOTPResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  StatusDate: string;
  Data:
    | { Token: { TokenType: string; TokenValidity: number; Token: string } }
    | { AttemptsRemaining: number }
    | null;
}

export interface SIMRegistrationPayload {
  FirstName: string;
  MiddleName: string;
  LastName: string;
  Gender: string;
  BirthDate: string;
  Address: string;
  Language: string;
  Email: string;
  Nationality: string;
  FaceFrontPhoto_b64: string;
  FaceSidePhoto_b64: string;
  IdDocType: string;
  IdDocSerialNumber: string;
  NationalIdNumber: string;
  IdDocFontPhoto_b64: string;
  IdDocRearPhoto_b64: string;
  SignaturePhotoAttId64: string;
  SIMType: string;
  ICC: string;
  IMSI: string;
  MSISDNType: string;
  MSISDN: string;
  MobileMoney_Registration: boolean;
}

export interface SIMRegistrationResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  Data: null | object;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function dataUrlToFile(
  dataUrl: string,
  filename = "document.jpg",
): File {
  const [header, base64] = dataUrl.split(",");

  const mime =
    header.match(/:(.*?);/)?.[1] ?? "image/jpeg";

  const binary = atob(base64);

  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], filename, { type: mime });
}

// ── OTP ───────────────────────────────────────────────────────────────────────

export async function apiGenerateOTP(
  msisdn: string,
  captchaToken: string,
): Promise<GenerateOTPResponse> {
  const { data } = await kycApi.post<GenerateOTPResponse>(
    `/HTTP_GenerateRegistrationOTP/`,
    null,
    {
      params: { msisdn },
      headers: { "X-Captcha-Token": captchaToken },
    },
  );
  return data;
}

export async function apiValidateOTP(
  msisdn: string,
  otp: string,
  captchaToken: string,
): Promise<ValidateOTPResponse> {
  const { data } = await kycApi.post<ValidateOTPResponse>(
    `/HTTP_ValidateRegistrationOTP/`,
    { MSISDN: msisdn, OTP: otp },
    {
      headers: { "X-Captcha-Token": captchaToken },
    },
  );
  return data;
}

// ── SIM Registration ──────────────────────────────────────────────────────────

export async function apiSubmitSIMRegistration(
  payload: SIMRegistrationPayload,
  token: string,
): Promise<SIMRegistrationResponse> {
  const { data } = await kycApi.post<SIMRegistrationResponse>(
    `/HTTP_FCDM_SIMRegistration_Add/`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        SourceApp: "",
      },
    },
  );
  return data;
}

// ── OCR / MRZ ─────────────────────────────────────────────────────────────────

export async function apiValidateMRZFromOCR(
  dataUrl: string,
  token: string,
): Promise<any> {
  const file = dataUrlToFile(dataUrl);

  const form = new FormData();
  form.append("file", file);

  const response = await kycApi.post(
    `/HTTP_ValidateMRZFromOCR/`,
    form,
    {
      // baseURL: ENV.MRZ_API_BASE_URL,
      headers: {
        "Content-Type": undefined,
        Authorization: `Bearer ${token}`,
        SourceApp: "",
      },
    },
  );

  return response.data;
}