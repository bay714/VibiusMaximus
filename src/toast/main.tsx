import React from "react";
import ReactDOM from "react-dom/client";
import { useTranslation } from "react-i18next";
import "@/i18n";
import { DEFAULT_AGAIN_KEY, showKey } from "../capture/keys";
import "./toast.css";

// Shown for a few seconds after Send. The app and the Paste again key come
// in the URL, so the window needs nothing else from the backend.
const params = new URLSearchParams(window.location.search);

const Toast: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="vibe-toast">
      <strong>{t("vibe.toast.sent", { app: params.get("app") ?? "" })}</strong>
      <span>
        {t("vibe.toast.again", {
          key: showKey(params.get("key") ?? DEFAULT_AGAIN_KEY),
        })}
      </span>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Toast />
  </React.StrictMode>,
);
