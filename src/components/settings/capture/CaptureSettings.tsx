import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { SettingContainer } from "../../ui/SettingContainer";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";
import { ShortcutInput } from "../ShortcutInput";

interface CaptureOptions {
  alwaysSubmit: boolean;
  captionBand: boolean;
  includeText: boolean;
  pasteGapMs: number;
  terminalApps: string[];
  copyOnlyApps: string[];
}

const toLines = (list: string[]) => list.join("\n");
const fromLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export const CaptureSettings: React.FC = () => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<CaptureOptions | null>(null);
  const [terminals, setTerminals] = useState("");
  const [copyOnly, setCopyOnly] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<CaptureOptions>("vibe_capture_settings_get").then((o) => {
      setOptions(o);
      setTerminals(toLines(o.terminalApps));
      setCopyOnly(toLines(o.copyOnlyApps));
    });
  }, []);

  const save = (next: CaptureOptions) => {
    setOptions(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => invoke("vibe_capture_settings_set", { options: next }),
      400,
    );
  };

  if (!options) return null;

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("vibe.captureSettings.title")}>
        <ShortcutInput shortcutId="capture" grouped={true} />
        <ShortcutInput shortcutId="board" grouped={true} />
        <ToggleSwitch
          checked={options.alwaysSubmit}
          onChange={(alwaysSubmit) => save({ ...options, alwaysSubmit })}
          label={t("vibe.captureSettings.alwaysSubmit")}
          description={t("vibe.captureSettings.alwaysSubmitDescription")}
          grouped={true}
        />
        <ToggleSwitch
          checked={options.captionBand}
          onChange={(captionBand) => save({ ...options, captionBand })}
          label={t("vibe.captureSettings.captionBand")}
          description={t("vibe.captureSettings.captionBandDescription")}
          grouped={true}
        />
        <ToggleSwitch
          checked={options.includeText}
          onChange={(includeText) => save({ ...options, includeText })}
          label={t("vibe.captureSettings.includeText")}
          description={t("vibe.captureSettings.includeTextDescription")}
          grouped={true}
        />
        <SettingContainer
          title={t("vibe.captureSettings.pasteGap")}
          description={t("vibe.captureSettings.pasteGapDescription")}
          grouped={true}
        >
          <Input
            type="number"
            min={0}
            max={3000}
            step={50}
            className="w-28"
            value={options.pasteGapMs}
            onChange={(e) =>
              save({
                ...options,
                pasteGapMs: Math.max(
                  0,
                  Math.min(3000, Number(e.target.value) || 0),
                ),
              })
            }
          />
        </SettingContainer>
      </SettingsGroup>

      <SettingsGroup
        title={t("vibe.captureSettings.profilesTitle")}
        description={t("vibe.captureSettings.profilesDescription")}
      >
        <SettingContainer
          title={t("vibe.captureSettings.terminalApps")}
          description={t("vibe.captureSettings.terminalAppsDescription")}
          descriptionMode="inline"
          layout="stacked"
          grouped={true}
        >
          <Textarea
            value={terminals}
            rows={5}
            className="w-full font-mono"
            onChange={(e) => {
              setTerminals(e.target.value);
              save({ ...options, terminalApps: fromLines(e.target.value) });
            }}
          />
        </SettingContainer>
        <SettingContainer
          title={t("vibe.captureSettings.copyOnlyApps")}
          description={t("vibe.captureSettings.copyOnlyAppsDescription")}
          descriptionMode="inline"
          layout="stacked"
          grouped={true}
        >
          <Textarea
            value={copyOnly}
            rows={3}
            className="w-full font-mono"
            onChange={(e) => {
              setCopyOnly(e.target.value);
              save({ ...options, copyOnlyApps: fromLines(e.target.value) });
            }}
          />
        </SettingContainer>
      </SettingsGroup>
    </div>
  );
};
