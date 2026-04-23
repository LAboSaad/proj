export default function ConsentStep({
  agreed,
  setAgreed,
  nextStep,
  modelsLoaded,
}: any) {
  return (
    <section className="space-y-5">
                   <h2 className="text-2xl font-semibold">Consent and privacy notice</h2>
                   <div className="space-y-4 text-sm leading-6 text-slate-300">
                     <p>
                    By proceeding, you agree to use this secure, mobile-friendly portal to complete your SIM card registration remotely. You will be asked to provide your identification details, capture your ID document, and take a live selfie to verify your identity. </p>
                     <p>
                      This process is designed to be simple and convenient while ensuring compliance with regulatory requirements and helping prevent fraud through validation and liveness checks.
                     </p>
                   </div>
                   <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
                     <input
                       type="checkbox"
                       className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900"
                       checked={agreed}
                       onChange={(e) => setAgreed(e.target.checked)}
                     />
                     <span>I agree to biometric capture and document processing for identity verification.</span>
                   </label>
                   <div className="flex gap-3">
                     <button
                       onClick={nextStep}
                       disabled={!agreed || !modelsLoaded}
                       className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                     >
                       Continue
                     </button>
                   </div>
                 </section>
  );
}