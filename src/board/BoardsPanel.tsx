import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface BoardMeta {
  id: string;
  name: string;
  created: number;
  updated: number;
  images: number;
  thumb?: string | null;
}

// Symbols, not translatable text.
const CLOSE = "×";
const PLUS = "+";

/** Every saved board: open one, rename it, delete it, or start a new one. */
export function BoardsPanel({
  currentId,
  onOpen,
  onNew,
  onDelete,
  onRenamed,
  onClose,
}: {
  currentId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRenamed: (id: string, name: string) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [boards, setBoards] = useState<BoardMeta[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = () =>
    invoke<BoardMeta[]>("vibe_boards_list")
      .then(setBoards)
      .catch(() => {
        setBoards([]);
      });
  useEffect(() => {
    load();
  }, []);

  const rename = async (id: string) => {
    setEditing(null);
    const name = draft.trim();
    if (!name) return;
    await invoke("vibe_board_rename", { id, name });
    onRenamed(id, name);
    load();
  };

  const when = (ms: number) =>
    new Date(ms).toLocaleString(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="vibe-boards">
      <div className="vibe-boards-head">
        <span className="vibe-boards-title">{t("vibe.boards.title")}</span>
        <button type="button" className="vibe-btn primary" onClick={onNew}>
          {PLUS} {t("vibe.boards.new")}
        </button>
        <button
          type="button"
          className="vibe-btn vibe-remove"
          aria-label={t("vibe.boards.close")}
          onClick={onClose}
        >
          {CLOSE}
        </button>
      </div>
      <div className="vibe-boards-list">
        {boards?.length === 0 && (
          <p className="vibe-boards-empty">{t("vibe.boards.empty")}</p>
        )}
        {boards?.map((b) => (
          <div
            key={b.id}
            className={`vibe-boards-card${b.id === currentId ? " current" : ""}`}
            onDoubleClick={() => onOpen(b.id)}
          >
            <div className="vibe-boards-thumb">
              {b.thumb && (
                <img src={`${convertFileSrc(b.thumb)}?v=${b.updated}`} alt="" />
              )}
            </div>
            <div className="vibe-boards-info">
              {editing === b.id ? (
                <input
                  className="vibe-input"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => rename(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rename(b.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <span
                  className="vibe-boards-name"
                  title={t("vibe.boards.renameHint")}
                  onClick={() => {
                    setDraft(b.name);
                    setEditing(b.id);
                  }}
                >
                  {b.name}
                </span>
              )}
              <span className="vibe-boards-meta">
                {t("vibe.boards.images", { count: b.images })} ·{" "}
                {when(b.updated)}
              </span>
              <div className="vibe-boards-actions">
                {b.id === currentId ? (
                  <span className="vibe-boards-open">
                    {t("vibe.boards.current")}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="vibe-btn"
                    onClick={() => onOpen(b.id)}
                  >
                    {t("vibe.boards.open")}
                  </button>
                )}
                <button
                  type="button"
                  className="vibe-btn vibe-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        t("vibe.boards.deleteConfirm", { name: b.name }),
                      )
                    )
                      onDelete(b.id);
                  }}
                >
                  {t("vibe.boards.delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
