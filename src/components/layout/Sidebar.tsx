
type Props = {
  busy: boolean;
  ocrProgress: number;
  documentQuality: any;
  payload: any;
};

export default function Sidebar({
  busy,
  ocrProgress,
  documentQuality,
  payload,
}: Props) {
  return (
     <aside className="space-y-6">
            {/* <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-3 text-sm font-medium text-slate-100">Hardening included</div>
              <div className="space-y-3 text-sm leading-6 text-slate-300">
                <p>Document quality scoring for blur, brightness, contrast, glare, and resolution.</p>
                <p>OCR image pre-processing to improve MRZ readability.</p>
                <p>Typed payload generation with explicit backend-ready structure.</p>
                <p>Editable extracted fields before final submission boundary.</p>
                <p>Conservative face similarity threshold with explicit review state.</p>
              </div>
            </div> */}

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-3 text-sm font-medium text-slate-100">Runtime status</div>
              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3">
                  <span>Busy</span>
                  <span className={busy ? "text-amber-300" : "text-emerald-300"}>{busy ? "Processing" : "Idle"}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3">
                  <span>OCR progress</span>
                  <span className="text-cyan-300">{ocrProgress}%</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3">
                  <span>Document quality</span>
                  <span className={documentQuality?.looksUsefulForOCR ? "text-emerald-300" : "text-slate-400"}>
                    {documentQuality ? (documentQuality.looksUsefulForOCR ? "Good" : "Weak") : "Not checked"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-3">
                  <span>Ready for submit</span>
                  <span className={payload.readyForBackendPost ? "text-emerald-300" : "text-slate-400"}>
                    {payload.readyForBackendPost ? "Yes" : "Not yet"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/20">
              <div className="mb-3 text-sm font-medium text-slate-100">Still recommended later</div>
              <ul className="space-y-3 text-sm leading-6 text-slate-300">
                <li>• Add document edge detection and automatic crop correction.</li>
                <li>• Move heavy OCR and anti-spoofing checks to the backend when available.</li>
                <li>• Add country-specific document templates and validation rules.</li>
                <li>• Add encryption, short-lived secure storage, and audit trace IDs.</li>
                <li>• Add accessibility, localization, retry analytics, and device risk signals.</li>
              </ul>
            </div>
          </aside>
  );
}