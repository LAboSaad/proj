// src/lib/api/kyc.api.ts

import axios from "axios";
import { ENV } from "../config/env";

const kycApi = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  // Never throw on any HTTP status — let the service layer read StatusCode
  // and StatusDescription from the response body and decide what to do.
  // Without this, Axios throws on 4xx/5xx before the body is ever read,
  // so StatusDescription ("Too many OTP requests…") never reaches the UI.
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
    OTPValidity: number; // seconds — drives the OTPSection countdown timer
  };
}

export interface ValidateOTPResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  // StatusDate is the server timestamp used to anchor the token expiry.
  // Using the server clock (not Date.now()) eliminates client/server skew.
  StatusDate: string;
  Data: // Success — token returned
    | { Token: { TokenType: string; TokenValidity: number; Token: string } }
    // Failure — server's authoritative remaining attempt count
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
