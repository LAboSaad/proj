import axios from "axios";
import { ENV } from "../config/env";

const kycApi = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateOTPResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  StatusDate: string;
  Data: {
    OTP: string;
    Token: {
      TokenType: string;
      TokenValidity: number;
      Token: string;
    };
  };
}

export interface ValidateOTPResponse {
  Status: string;
  StatusCode: number;
  StatusDescription: string;
  Data: null | object;
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
): Promise<GenerateOTPResponse> {
  const { data } = await kycApi.post<GenerateOTPResponse>(
    `/HTTP_GenerateRegistrationOTP/`,
    null,
    { params: { msisdn } },
  );
  return data;
}

export async function apiValidateOTP(
  msisdn: string,
  otp: string,
  token: string,
): Promise<ValidateOTPResponse> {
  const { data } = await kycApi.post<ValidateOTPResponse>(
    `/HTTP_ValidateRegistrationOTP/`,
    { MSISDN: msisdn, OTP: otp },
    { headers: { Authorization: `Bearer ${token}` } },
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