import { useState } from "react";

export default function OTPSection({ onVerify }: any) {
  const [input, setInput] = useState("");

  return (
    <div className="space-y-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter OTP"
        className="w-full rounded-xl p-3 bg-slate-900 border border-slate-700"
      />

      <button
        onClick={() => onVerify(input)}
        className="bg-green-500 px-4 py-2 rounded-xl"
      >
        Verify OTP
      </button>
    </div>
  );
}