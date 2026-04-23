import registeredUsers from "../../mock/registeredUsers.json";

type CheckResult =
  | "REGISTERED"
  | "ELIGIBLE"
  | "INVALID";

export function checkMSISDN(msisdn: string): CheckResult {
  // basic format validation
  if (!msisdn.startsWith("243") || msisdn.length < 10) {
    return "INVALID";
  }

  const exists = registeredUsers.find(
    (u) => u.msisdn === msisdn
  );

  if (exists) return "REGISTERED";

  return "ELIGIBLE";
}

// 🔥 OTP generator (mock)
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}