import { cx } from "../../lib/utils";

type Step = {
  key: string;
  label: string;
};

type Props = {
  steps: Step[];
  stepIndex: number;
};

export default function Stepper({ steps, stepIndex }: Props) {
  return (
     <div className="mb-8 grid gap-3 md:grid-cols-6">
          {steps.map((step, index) => {
            const done = index < stepIndex;
            const active = index === stepIndex;
            return (
              <div
                key={step.key}
                className={cx(
                  "rounded-2xl border px-4 py-3 text-sm shadow-lg transition",
                  active && "border-cyan-400 bg-cyan-500/10 text-cyan-100",
                  done && "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
                  !active && !done && "border-slate-800 bg-slate-900 text-slate-400"
                )}
              >
                <div className="mb-1 text-xs uppercase tracking-wide opacity-70">Step {index + 1}</div>
                <div className="font-medium">{step.label}</div>
              </div>
            );
          })}
        </div>
  );
}