import { useEffect, useState } from "react";
import i18n from "../../assets/i18n";

const languages = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
];

export function LanguageSwitcher() {
  const [lang, setLang] = useState(i18n.language || "en");

  useEffect(() => {
    const current = i18n.language || "en";
    setLang(current);

    document.dir = current === "ar" ? "rtl" : "ltr";
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLang = e.target.value;
    setLang(selectedLang);
    i18n.changeLanguage(selectedLang);

    // update direction immediately
    document.dir = selectedLang === "ar" ? "rtl" : "ltr";
  };

  return (
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
  );
}