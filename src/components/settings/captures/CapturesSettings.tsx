import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { Button } from "../../ui/Button";

interface CaptureRecord {
  id: string;
  path: string;
  text: string;
  target: string;
  created: number;
  starred: boolean;
}

const STAR = "★";
const NO_STAR = "☆";

export const CapturesSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [captures, setCaptures] = useState<CaptureRecord[]>([]);
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    invoke<CaptureRecord[]>("vibe_captures_list").then(setCaptures);
  }, []);
  useEffect(load, [load]);

  const act = async (task: Promise<unknown>, done: string) => {
    try {
      await task;
      setStatus(done);
    } catch (e) {
      setStatus(String(e));
    }
  };

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleString(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup
        title={t("vibe.captures.title")}
        description={status || t("vibe.captures.description")}
      >
        {captures.length === 0 ? (
          <p className="p-4 text-sm text-mid-gray">
            {t("vibe.captures.empty")}
          </p>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3">
            {captures.map((c) => (
              <div
                key={c.id}
                className="border border-mid-gray/20 rounded-lg overflow-hidden"
              >
                <img
                  src={convertFileSrc(c.path)}
                  alt=""
                  loading="lazy"
                  className="w-full h-32 object-contain bg-white"
                />
                <div className="p-2 space-y-2">
                  <p className="text-xs line-clamp-2 min-h-[2rem]">
                    {c.text || t("vibe.captures.noText")}
                  </p>
                  <p className="text-xs text-mid-gray">
                    {formatDate(c.created)}
                    {c.target ? ` · ${c.target}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        act(
                          invoke("vibe_capture_copy", {
                            id: c.id,
                            what: "image",
                          }),
                          t("vibe.captures.copiedImage"),
                        )
                      }
                    >
                      {t("vibe.captures.copyImage")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!c.text}
                      onClick={() =>
                        act(
                          invoke("vibe_capture_copy", {
                            id: c.id,
                            what: "text",
                          }),
                          t("vibe.captures.copiedText"),
                        )
                      }
                    >
                      {t("vibe.captures.copyText")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        act(
                          invoke("vibe_capture_to_board", { id: c.id }),
                          t("vibe.captures.addedToBoard"),
                        )
                      }
                    >
                      {t("vibe.captures.toBoard")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("vibe.captures.star")}
                      onClick={() =>
                        invoke("vibe_capture_star", {
                          id: c.id,
                          starred: !c.starred,
                        }).then(load)
                      }
                    >
                      {c.starred ? STAR : NO_STAR}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revealItemInDir(c.path)}
                    >
                      {t("vibe.captures.showInFolder")}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-ghost"
                      onClick={() =>
                        invoke("vibe_capture_delete", { id: c.id }).then(load)
                      }
                    >
                      {t("vibe.captures.delete")}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
};
