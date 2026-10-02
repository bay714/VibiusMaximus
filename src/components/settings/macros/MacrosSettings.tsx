import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { SettingContainer } from "../../ui/SettingContainer";
import { Input } from "../../ui/Input";
import { Textarea } from "../../ui/Textarea";
import { Button } from "../../ui/Button";
import { Dropdown } from "../../ui/Dropdown";
import { ToggleSwitch } from "../../ui/ToggleSwitch";
import { ShortcutInput } from "../ShortcutInput";
import { useSettings } from "../../../hooks/useSettings";

type InsertBefore = "nothing" | "space" | "newline";

interface Macro {
  id: string;
  name: string;
  body: string;
  insertBefore: InsertBefore;
  submit: boolean;
}

const PLUS = "＋";
const newId = () => `m${Date.now().toString(36)}`;

export const MacrosSettings: React.FC = () => {
  const { t } = useTranslation();
  const { refreshSettings } = useSettings();
  const [macros, setMacros] = useState<Macro[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<Macro[]>("vibe_macros_list").then((list) => {
      setMacros(list);
      setSelectedId((id) => id ?? list[0]?.id ?? null);
    });
  }, []);

  const selected = macros.find((m) => m.id === selectedId) ?? null;

  const persist = useCallback(
    async (item: Macro, immediate = false) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const run = async () => {
        await invoke<Macro[]>("vibe_macro_save", { item });
        await refreshSettings();
      };
      if (immediate) await run();
      else saveTimer.current = setTimeout(run, 400);
    },
    [refreshSettings],
  );

  const update = (patch: Partial<Macro>) => {
    if (!selected) return;
    const item = { ...selected, ...patch };
    setMacros((ms) => ms.map((m) => (m.id === item.id ? item : m)));
    persist(item);
  };

  const add = async () => {
    const item: Macro = {
      id: newId(),
      name: t("vibe.macros.newName"),
      body: "",
      insertBefore: "space",
      submit: false,
    };
    setMacros((ms) => [...ms, item]);
    setSelectedId(item.id);
    await persist(item, true);
  };

  const remove = async () => {
    if (!selected) return;
    const list = await invoke<Macro[]>("vibe_macro_delete", {
      id: selected.id,
    });
    setMacros(list);
    setSelectedId(list[0]?.id ?? null);
    await refreshSettings();
  };

  const clearHotkey = async () => {
    if (!selected) return;
    await invoke("vibe_macro_clear_hotkey", { id: selected.id });
    await refreshSettings();
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup
        title={t("vibe.macros.title")}
        description={t("vibe.macros.description")}
      >
        <div className="p-3 flex flex-wrap gap-2">
          {macros.length === 0 && (
            <span className="text-sm text-mid-gray">
              {t("vibe.macros.empty")}
            </span>
          )}
          {macros.map((m) => (
            <Button
              key={m.id}
              size="sm"
              variant={m.id === selectedId ? "primary-soft" : "secondary"}
              onClick={() => setSelectedId(m.id)}
            >
              {m.name || "…"}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={add}>
            {PLUS} {t("vibe.macros.add")}
          </Button>
        </div>
      </SettingsGroup>

      {selected && (
        <SettingsGroup>
          <SettingContainer
            title={t("vibe.macros.name")}
            description={t("vibe.macros.name")}
            grouped={true}
          >
            <Input
              value={selected.name}
              onChange={(e) => update({ name: e.target.value })}
              className="w-64"
            />
          </SettingContainer>
          <ShortcutInput shortcutId={`macro:${selected.id}`} grouped={true} />
          <SettingContainer
            title={t("vibe.macros.clearHotkey")}
            description={t("vibe.macros.clearHotkey")}
            grouped={true}
          >
            <Button size="sm" variant="secondary" onClick={clearHotkey}>
              {t("vibe.macros.clearHotkey")}
            </Button>
          </SettingContainer>
          <SettingContainer
            title={t("vibe.macros.body")}
            description={t("vibe.macros.bodyHint")}
            descriptionMode="inline"
            layout="stacked"
            grouped={true}
          >
            <Textarea
              value={selected.body}
              onChange={(e) => update({ body: e.target.value })}
              className="w-full"
              rows={5}
            />
          </SettingContainer>
          <SettingContainer
            title={t("vibe.macros.insertBefore")}
            description={t("vibe.macros.insertBefore")}
            grouped={true}
          >
            <Dropdown
              selectedValue={selected.insertBefore}
              onSelect={(v) => update({ insertBefore: v as InsertBefore })}
              options={[
                { value: "nothing", label: t("vibe.macros.insertNothing") },
                { value: "space", label: t("vibe.macros.insertSpace") },
                { value: "newline", label: t("vibe.macros.insertNewline") },
              ]}
            />
          </SettingContainer>
          <ToggleSwitch
            checked={selected.submit}
            onChange={(submit) => update({ submit })}
            label={t("vibe.macros.submit")}
            description={t("vibe.macros.submit")}
            grouped={true}
          />
          <div className="p-3 flex justify-end">
            <Button size="sm" variant="danger-ghost" onClick={remove}>
              {t("vibe.macros.delete")}
            </Button>
          </div>
        </SettingsGroup>
      )}
    </div>
  );
};
