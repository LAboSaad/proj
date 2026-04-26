import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import App from "./App";
import "./index.css";

// Add VITE_RECAPTCHA_SITE_KEY=your_key to your .env file
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string;

if (!SITE_KEY) {
  console.warn(
    "⚠ VITE_RECAPTCHA_SITE_KEY is not set. reCAPTCHA will not work.\n" +
    "Add it to your .env file: VITE_RECAPTCHA_SITE_KEY=your_site_key"
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleReCaptchaProvider
      reCaptchaKey={SITE_KEY ?? ""}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
      // Hide the floating badge — disclosure text is shown in MSISDNStep instead
      container={{
        parameters: {
          badge: "bottomright",
          theme: "dark",
        },
      }}
    >
      <App />
    </GoogleReCaptchaProvider>
  </React.StrictMode>
);