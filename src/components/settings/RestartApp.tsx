import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";

/** VibiusMaximus: restart the app, for when dictation stops responding after
 *  a long session. Also in the tray menu. */
export const RestartApp: React.FC<{ grouped?: boolean }> = ({ grouped }) => {
  const { t } = useTranslation();
  const [restarting, setRestarting] = useState(false);

  return (
    <SettingContainer
      title={t("settings.restart.title")}
      description={t("settings.restart.description")}
      descriptionMode="tooltip"
      grouped={grouped}
    >
      <Button
        variant="secondary"
        size="md"
        disabled={restarting}
        onClick={() => {
          setRestarting(true);
          invoke("vibe_restart").catch(() => setRestarting(false));
        }}
      >
        {restarting
          ? t("settings.restart.restarting")
          : t("settings.restart.button")}
      </Button>
    </SettingContainer>
  );
};
