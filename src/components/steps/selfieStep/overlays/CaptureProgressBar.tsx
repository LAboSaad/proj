import type { CaptureStatus } from "../../../../hooks/useSelfie";
import { PROGRESS_STEPS, PHASE_TO_STEP } from "../selfie.constants";

interface CaptureProgressBarProps {
  phase: CaptureStatus["phase"];
}

export function CaptureProgressBar({ phase }: CaptureProgressBarProps) {
  const activeStep = PHASE_TO_STEP[phase];

  return (
    <div className="flex items-center gap-2 w-full">
      {PROGRESS_STEPS.map((s, i) => {
        const done   = i < activeStep;
        const active = i === activeStep - 1 || (activeStep === 0 && i === 0);

        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-300 flex-1 ${
              done    ? "bg-emerald-900/60 border border-emerald-700/50 text-emerald-300"
              : active  ? "bg-cyan-900/60 border border-cyan-700 text-cyan-200"
              :           "bg-slate-800/60 border border-slate-700 text-slate-500"
            }`}>
              <span>{s.icon}</span>
              <span className="truncate">{s.label}</span>
              {done   && <span className="ml-auto">✓</span>}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />}
            </div>

            {i < PROGRESS_STEPS.length - 1 && (
              <div className={`h-px w-3 shrink-0 transition-all duration-500 ${done ? "bg-emerald-600" : "bg-slate-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}