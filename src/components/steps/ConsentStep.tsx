import { useTranslation } from "react-i18next";

export default function ConsentStep({
  agreed,
  setAgreed,
  nextStep,
  modelsLoaded,
}: any) {
  const { t } = useTranslation();

  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-semibold">
        {t("consent_title")}
      </h2>

      <div className="space-y-4 text-sm leading-6 text-slate-300">
        <p>{t("consent_desc_1")}</p>
        <p>{t("consent_desc_2")}</p>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>{t("consent_checkbox")}</span>
      </label>

      <button
        onClick={nextStep}
        disabled={!agreed || !modelsLoaded}
        className="rounded-2xl bg-cyan-500 px-5 py-3"
      >
        {t("continue")}
      </button>
    </section>
  );
}