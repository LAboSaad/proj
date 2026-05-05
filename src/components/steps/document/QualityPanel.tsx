// src/components/steps/document/ui/QualityPanel.tsx
//
// Displays document image quality metrics from analyzeDocumentQuality().

import type { DocumentQuality } from "../../../types/kyc";

interface QualityPanelProps {
  quality: DocumentQuality | null;
}

interface MetricRowProps {
  label: string;
  value: string | number;
}

function MetricRow({ label, value }: MetricRowProps) {
  return (
    <div>
      {label}: <span className="text-cyan-300">{value}</span>
    </div>
  );
}

export function QualityPanel({ quality }: QualityPanelProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
      <div className="mb-3 text-xs uppercase tracking-wide text-slate-500">
        Quality checks
      </div>

      {quality ? (
        <div className="space-y-2">
          <MetricRow
            label="Resolution"
            value={`${quality.width} × ${quality.height}`}
          />
          <MetricRow label="Brightness" value={quality.brightness} />
          <MetricRow label="Contrast" value={quality.contrast} />
          <MetricRow label="Blur score" value={quality.blurScore} />
          <MetricRow label="Glare ratio" value={quality.glareRatio} />

          <div>
            Verdict:{" "}
            <span
              className={
                quality.looksUsefulForOCR
                  ? "text-emerald-300"
                  : "text-amber-300"
              }
            >
              {quality.looksUsefulForOCR ? "Good for OCR" : "Needs improvement"}
            </span>
          </div>

          {quality.reasons.length > 0 && (
            <ul className="mt-3 space-y-2 rounded-2xl bg-slate-900 p-3 text-xs text-slate-200">
              {quality.reasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="text-slate-400">No quality analysis yet.</div>
      )}
    </div>
  );
}
