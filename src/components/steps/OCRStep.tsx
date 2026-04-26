import { mapFieldKey } from "../../lib/utils";

export default function OCRStep({
  fields,
  setFields,
  runFaceMatch,
  prevStep,
  mrzValid,
  mrzMessage,
  busy
}: any) {
  return (
    <section className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold">OCR and MRZ results</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Review extracted fields before running the selfie-to-document face comparison.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ["First name", fields.firstName],
                    ["Last name", fields.lastName],
                    ["Document number", fields.documentNumber],
                    ["Nationality", fields.nationality],
                    ["Birth date", fields.birthDate],
                    ["Expiry date", fields.expiryDate],
                    ["Sex", fields.sex],
                  ].map(([label, value]) => {
                    const key = mapFieldKey(label);
                    console.log("Fields", fields);
                    return (
                      <label key={label} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                        <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">{label}</div>
                        <input
                          value={String(value)}
                          onChange={(e) => setFields((prev:any) => ({ ...prev, [key]: e.target.value }))}
                          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">MRZ validation</div>
                    <div>
                      Status:{" "}
                      {mrzValid === null ? (
                        <span className="text-slate-400">Not available</span>
                      ) : mrzValid ? (
                        <span className="text-emerald-300">Valid</span>
                      ) : (
                        <span className="text-amber-300">Invalid or partial</span>
                      )}
                    </div>
                    <div className="mt-2 text-slate-200">{mrzMessage || "No MRZ message."}</div>
                    <pre className="mt-4 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-200">{fields.rawMRZ || "No MRZ extracted."}</pre>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Raw OCR text</div>
                    <pre className="overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-200 whitespace-pre-wrap">{fields.rawOCRText || "No OCR text available."}</pre>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button onClick={prevStep} className="rounded-2xl border border-slate-700 px-5 py-3 text-slate-200">
                    Back
                  </button>
                  <button onClick={() => void runFaceMatch()} disabled={busy} className="rounded-2xl bg-cyan-500 px-5 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                    Run face match
                  </button>
                </div>
              </section>
  );
}