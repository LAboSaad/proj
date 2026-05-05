
import type { LivenessPhase } from "../../../../hooks/useFaceLiveness";
import type { CaptureStatus } from "../../../../hooks/useSelfie";

interface StatusBannerProps {
  phase:        LivenessPhase;
  capturePhase: CaptureStatus["phase"];
  countdown:    number;
  faceDetected: boolean;
  qualityOk:    boolean;
  hint:         string;
}

export function StatusBanner({
  phase,
  capturePhase,
  countdown,
  faceDetected,
  qualityOk,
  hint,
}: StatusBannerProps) {
  // ── Capture phases ────────────────────────────────────────────────────────
  if (capturePhase === "front-guide") {
    if (!faceDetected) return (
      <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <p className="text-sm text-slate-300">Position your face in the oval to begin auto-capture</p>
      </div>
    );
    if (!qualityOk) return (
      <div className="flex items-center gap-3 rounded-2xl bg-amber-950/60 border border-amber-700/50 px-4 py-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
        <p className="text-sm text-amber-200">Face detected — move a little closer for better quality</p>
      </div>
    );
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-cyan-950/60 border border-cyan-700/50 px-4 py-3">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
        <p className="text-sm text-cyan-200">Hold still — starting auto-capture…</p>
      </div>
    );
  }

  if (capturePhase === "front-countdown") return (
    <div className="flex items-center gap-3 rounded-2xl bg-amber-950/60 border border-amber-600/60 px-4 py-3">
      <div className="text-amber-400 text-lg font-bold shrink-0">{countdown}</div>
      <p className="text-sm text-amber-200 font-medium">
        Capturing in {countdown}… hold still and look at the camera
      </p>
    </div>
  );

  if (capturePhase === "front-captured") return (
    <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
      <span className="text-emerald-400 text-lg shrink-0">✓</span>
      <p className="text-sm text-emerald-200 font-medium">Front photo captured! Preparing side photo…</p>
    </div>
  );

  if (capturePhase === "side-guide") return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
      <span className="text-2xl shrink-0">↩️</span>
      <div>
        <p className="text-sm text-white font-medium">Now take a side photo</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Slowly turn your head to the right until the indicator fills
        </p>
      </div>
    </div>
  );

  if (capturePhase === "side-ready") return (
    <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
      <span className="text-emerald-400 text-lg shrink-0">✓</span>
      <p className="text-sm text-emerald-200 font-medium">Perfect angle! Tap the button to capture.</p>
    </div>
  );

  if (capturePhase === "side-captured" || capturePhase === "complete") return (
    <div className="flex items-center gap-3 rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3">
      <span className="text-emerald-400 text-lg shrink-0">🎉</span>
      <p className="text-sm text-emerald-200 font-medium">All photos captured! Proceeding…</p>
    </div>
  );

  // ── Liveness phase — show landmark hint ───────────────────────────────────
  void phase; // consumed indirectly via hint from useFaceLiveness
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-800/80 border border-slate-700 px-4 py-3">
      <div className={`w-2 h-2 rounded-full shrink-0 ${faceDetected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
      <p className="text-sm text-slate-300 truncate">{hint}</p>
    </div>
  );
}