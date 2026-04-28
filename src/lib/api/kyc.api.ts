import axios from "axios";
import { ENV } from "../config/env";

const kycApi = axios.create({
  baseURL: ENV.API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});


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


export async function apiGenerateOTP(msisdn: string): Promise<GenerateOTPResponse> {
  const { data } = await kycApi.post<GenerateOTPResponse>(
    `/HTTP_GenerateRegistrationOTP/`,
    null,
    { params: { msisdn } }
  );
  return data;
}

export async function apiValidateOTP(
  msisdn: string,
  otp: string,
  token: string
): Promise<ValidateOTPResponse> {
  const { data } = await kycApi.post<ValidateOTPResponse>(
    `/HTTP_ValidateRegistrationOTP/`,
    { MSISDN: msisdn, OTP: otp },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return data;
}