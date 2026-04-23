import { useState } from "react";
import { generateOTP } from "../../lib/services/msisdn.service";
import OTPSection from "./OTPSection";
import registeredUsers from "../../mock/registeredUsers.json";

type Status = "IDLE" | "REGISTERED" | "OTP_SENT";

export default function MSISDNStep({
  msisdn,
  setMsisdn,
  nextStep,
  setIsEligible,
}: any) {
  const [status, setStatus] = useState<Status>("IDLE");
  const [otp, setOtp] = useState("");

  // ✅ Normalize number (remove + for comparison)
  const normalize = (num: string) => num.replace(/^\+/, "");

  // ✅ enforce international input format while typing
  const handleChange = (value: string) => {
    let cleaned = value.replace(/[^\d+]/g, "");

    // allow only ONE "+" at the start
    if (cleaned.includes("+")) {
      cleaned = "+" + cleaned.replace(/\+/g, "").replace(/^\+/, "");
    }

    setMsisdn(cleaned);
  };

  // ✅ simple E.164 check
  const isInternationalFormat = /^\+?[1-9]\d{7,14}$/.test(msisdn);

  const handleCheck = () => {
    if (!isInternationalFormat) {
      alert("Enter a valid international phone number (e.g. +243XXXXXXXXX)");
      return;
    }

    const normalizedInput = normalize(msisdn);

    // 🔥 CHECK AGAINST JSON
    const existingUser = registeredUsers.find(
      (user) => normalize(user.msisdn) === normalizedInput
    );

    if (existingUser) {
      setStatus("REGISTERED");
      setIsEligible(false);
      return;
    }

    // ✅ NOT FOUND → OTP FLOW
    const generatedOtp = generateOTP();
    console.log("📩 OTP (mock):", generatedOtp);

    setOtp(generatedOtp);
    setStatus("OTP_SENT");
    setIsEligible(true);
  };

const handleVerifyOTP = (inputOtp: string) => {
  if (!inputOtp) return;

    nextStep();
 
};

return (
  <div className="space-y-4">
    <h2 className="text-xl font-semibold">Enter Mobile Number</h2>

    {/* ❌ Already registered */}
    {status === "REGISTERED" && (
      <p className="text-red-400">
        This number is already registered.
      </p>
    )}

    {/* ✅ STEP 1: PHONE INPUT */}
    {status !== "OTP_SENT" && (
      <>
        <input
          value={msisdn}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. +243970000001"
          inputMode="tel"
          className="w-full rounded-xl p-3 bg-slate-900 border border-slate-700"
        />

        <button
          onClick={handleCheck}
          className="bg-cyan-500 px-4 py-2 rounded-xl"
        >
          Continue
        </button>
      </>
    )}

    {/* ✅ STEP 2: OTP ONLY (REPLACES INPUT) */}
    {status === "OTP_SENT" && (
      <OTPSection onVerify={handleVerifyOTP} />
    )}
  </div>
);
}