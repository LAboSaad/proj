import { useEffect, useState } from "react";
import i18n from "../../assets/i18n";
import type { SessionTimers } from "../../hooks/useSessionTimers";

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

interface Props {
  timers: SessionTimers;
}

export function LanguageSwitcher({ timers }: Props) {
  const [lang, setLang] = useState(i18n.language || "en");

  useEffect(() => {
    const current = i18n.language || "en";
    setLang(current);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = e.target.value;
    setLang(selectedLang);
    i18n.changeLanguage(selectedLang);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Session timer */}
      {timers.sessionActive && (
        <TimerBadge
          label="Session"
          value={timers.sessionTimeLeft}
          expired={timers.sessionExpired}
        />
      )}

      {/* Language select */}
      <div className="relative">
        <select
          value={lang}
          onChange={handleChange}
          className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-slate-200 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
        >
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Timer badge ───────────────────────────────────────────────────────────────
function TimerBadge({
  label,
  value,
  expired,
}: {
  label: string;
  value: string;
  expired: boolean;
}) {
  const isZero = value === "00:00";

  // Color: green > 2 min, amber ≤ 2 min, red expired/zero
  const color =
    expired || isZero
      ? "text-slate-500"
      : parseInt(value.split(":")[0]) === 0 &&
          parseInt(value.split(":")[1]) <= 120
        ? "text-amber-400"
        : "text-emerald-400";

  // Pulse when under 1 minute and not zero
  const pulse = !isZero && !expired && value.startsWith("00:");

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
      <span className="text-slate-400 text-xs uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`font-mono font-semibold ${color} ${pulse ? "animate-pulse" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
