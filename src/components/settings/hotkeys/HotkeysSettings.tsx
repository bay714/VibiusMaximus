import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { SettingContainer } from "../../ui/SettingContainer";
import { ShortcutInput } from "../ShortcutInput";
import { ResetButton } from "../../ui/ResetButton";
import { useSettings } from "../../../hooks/useSettings";
import {
  DEFAULT_KEYS,
  DEFAULT_PASTE_KEY,
  KEY_ACTIONS,
  comboFromEvent,
  isGlobalCombo,
  showKey,
  type KeyAction,
} from "../../../capture/keys";

interface CaptureOptions {
  keys?: Partial<Record<KeyAction, string>>;
  pasteKey?: string;
  [other: string]: unknown;
}

interface Macro {
  id: string;
  name: string;
}

// Excalidraw's own keys: shown for reference, not changeable.
const DRAWING_KEYS = [
  ["V", "select"],
  ["R", "rectangle"],
  ["O", "circle"],
  ["D", "diamond"],
  ["A", "arrow"],
  ["L", "line"],
  ["P", "draw"],
  ["T", "text"],
  ["E", "eraser"],
  ["H", "hand"],
  ["Delete", "delete"],
  ["Mod+Z", "undo"],
  ["Mod+Y", "redo"],
] as const;

/** "Ctrl+Enter" shown as "Ctrl + Enter", like Handy's shortcut rows. */
const display = (combo: string) => showKey(combo, " + ");

/** Click, then press the new combo. Clicking away cancels. Looks like
 *  Handy's shortcut rows. */
const KeyRecorder: React.FC<{
  value: string;
  isDefault: boolean;
  onChange: (combo: string) => string | null;
  onReset: () => void;
}> = ({ value, isDefault, onChange, onReset }) => {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      if (!combo) return;
      e.preventDefault();
      e.stopPropagation();
      setError(onChange(combo));
      setRecording(false);
    };
    const stop = () => setRecording(false);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", stop);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", stop);
    };
  }, [recording, onChange]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => {
            setError(null);
            setRecording(true);
          }}
          className={`px-2 py-1 text-sm font-semibold rounded-md border ${
            recording
              ? "border-logo-primary bg-logo-primary/20"
              : "bg-mid-gray/10 border-mid-gray/80 hover:bg-logo-primary/10 hover:border-logo-primary"
          }`}
        >
          {recording ? t("vibe.hotkeys.press") : display(value)}
        </button>
        <ResetButton
          disabled={isDefault}
          ariaLabel={t("vibe.hotkeys.reset")}
          onClick={() => {
            setError(null);
            onReset();
          }}
        />
      </div>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
};

export const HotkeysSettings: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const [options, setOptions] = useState<CaptureOptions | null>(null);
  const [macros, setMacros] = useState<Macro[]>([]);

  useEffect(() => {
    invoke<CaptureOptions>("vibe_capture_settings_get").then(setOptions);
    invoke<Macro[]>("vibe_macros_list").then(setMacros);
  }, []);

  if (!options) return null;

  const save = (next: CaptureOptions) => {
    setOptions(next);
    invoke("vibe_capture_settings_set", { options: next });
  };
  const keys = { ...DEFAULT_KEYS, ...(options.keys ?? {}) };
  const pasteKey = options.pasteKey || DEFAULT_PASTE_KEY;

  const setKey = (action: KeyAction, combo: string) => {
    const clash = KEY_ACTIONS.find((a) => a !== action && keys[a] === combo);
    if (clash)
      return t("vibe.hotkeys.conflict", {
        action: t(`vibe.hotkeys.actions.${clash}`),
      });
    const next = { ...(options.keys ?? {}), [action]: combo };
    if (combo === DEFAULT_KEYS[action]) delete next[action];
    save({ ...options, keys: next });
    return null;
  };

  const resetKey = (action: KeyAction) => {
    const next = { ...(options.keys ?? {}) };
    delete next[action];
    save({ ...options, keys: next });
  };

  const setPasteKey = (combo: string) => {
    if (!isGlobalCombo(combo)) return t("vibe.hotkeys.pasteKeyInvalid");
    save({ ...options, pasteKey: combo });
    return null;
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup
        title={t("vibe.hotkeys.global")}
        description={t("vibe.hotkeys.globalDescription")}
      >
        <ShortcutInput shortcutId="transcribe" grouped={true} />
        {getSetting("post_process_enabled") && (
          <ShortcutInput
            shortcutId="transcribe_with_post_process"
            grouped={true}
          />
        )}
        <ShortcutInput shortcutId="cancel" grouped={true} />
        <ShortcutInput shortcutId="capture" grouped={true} />
        <ShortcutInput shortcutId="board" grouped={true} />
        <SettingContainer
          title={t("vibe.hotkeys.pasteKey")}
          description={t("vibe.hotkeys.pasteKeyDescription")}
          grouped={true}
        >
          <KeyRecorder
            value={pasteKey}
            isDefault={pasteKey === DEFAULT_PASTE_KEY}
            onChange={setPasteKey}
            onReset={() => save({ ...options, pasteKey: DEFAULT_PASTE_KEY })}
          />
        </SettingContainer>
      </SettingsGroup>

      {macros.length > 0 && (
        <SettingsGroup
          title={t("vibe.hotkeys.macros")}
          description={t("vibe.hotkeys.macrosDescription")}
        >
          {macros.map((m) => (
            <ShortcutInput
              key={m.id}
              shortcutId={`macro:${m.id}`}
              grouped={true}
            />
          ))}
        </SettingsGroup>
      )}

      <SettingsGroup
        title={t("vibe.hotkeys.canvas")}
        description={t("vibe.hotkeys.canvasDescription")}
      >
        {KEY_ACTIONS.map((action) => (
          <SettingContainer
            key={action}
            title={t(`vibe.hotkeys.actions.${action}`)}
            description={t(`vibe.hotkeys.actions.${action}Description`)}
            grouped={true}
          >
            <KeyRecorder
              value={keys[action]}
              isDefault={keys[action] === DEFAULT_KEYS[action]}
              onChange={(combo) => setKey(action, combo)}
              onReset={() => resetKey(action)}
            />
          </SettingContainer>
        ))}
      </SettingsGroup>

      <SettingsGroup
        title={t("vibe.hotkeys.drawing")}
        description={t("vibe.hotkeys.drawingDescription")}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 p-4 text-sm">
          {DRAWING_KEYS.map(([key, tool]) => (
            <div key={tool} className="flex justify-between">
              <span>{t(`vibe.hotkeys.tools.${tool}`)}</span>
              <kbd className="px-1.5 rounded border border-mid-gray/40 text-xs font-semibold">
                {showKey(key, " + ")}
              </kbd>
            </div>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
};
