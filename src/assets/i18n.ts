import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector) // detects browser language
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: true,

    resources: {
      en: {
        translation: {
          consent_title: "Consent and privacy notice",
          consent_desc_1:
            "By proceeding, you agree to use this secure, mobile-friendly portal to complete your SIM card registration remotely.",
          consent_desc_2:
            "This process ensures compliance and prevents fraud through validation and liveness checks.",
          consent_checkbox:
            "I agree to biometric capture and document processing for identity verification.",
          continue: "Continue",
          back: "Back",

          document_title: "Document capture",
          upload_image: "Upload image",
          camera: "Camera",
        },
      },

      fr: {
        translation: {
          consent_title: "Consentement et confidentialité",
          continue: "Continuer",
          back: "Retour",
        },
      },

      ar: {
        translation: {
          consent_title: "الموافقة وإشعار الخصوصية",
          continue: "متابعة",
          back: "رجوع",
        },
      },
    },
  });

export default i18n;