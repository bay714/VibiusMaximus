import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Excalidraw,
  FONT_FAMILY,
  convertToExcalidrawElements,
  exportToBlob,
} from "@excalidraw/excalidraw";
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import {
  cleanupText,
  closeCapture,
  formatText,
  sendCapture,
  type SendMode,
  type SessionTarget,
} from "./api";
import {
  PIN_COLOR,
  PIN_KEY,
  PinNoteRow,
  PinTools,
  isPinKey,
  usePins,
  type Note,
} from "./pins";

// Fonts are bundled under /public/excalidraw so Excalidraw never fetches them
// from a CDN.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
  "/excalidraw/";

export interface Crop {
  dataURL: string;
  /** Physical pixels. */
  width: number;
  height: number;
  /** Physical pixels per CSS pixel. */
  scale: number;
}

/** What a capture saves so it can be reopened from history. */
export interface SavedScene {
  v: 1;
  crop: Crop;
  elements: readonly ExcalidrawElement[];
  caption: string;
  notes: Note[];
}

/** Editor state to start from when a capture is reopened. */
export interface Restore {
  elements?: readonly ExcalidrawElement[];
  caption: string;
  notes: Note[];
}

type Skeleton = Parameters<typeof convertToExcalidrawElements>[0];

// Key names and symbols, not translatable text.
// Plain Enter never sends: it's too easy to hit by accident.
const KEYS = {
  cleanup: "Ctrl+K",
  pin: PIN_KEY,
  cancel: "Esc",
  copy: "Alt+C",
  board: "Alt+Enter",
  sendSubmit: "Ctrl+Shift+Enter",
  send: "Ctrl+Enter",
} as const;
const SPARKLE = "✨";
const FILE_ID = "vibe-capture" as FileId;
const isTextField = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

export default function Editor({
  crop,
  target,
  restore,
}: {
  crop: Crop;
  /** Where Send pastes. Null when that window is gone (reopened captures). */
  target: SessionTarget | null;
  restore?: Restore;
}) {
  const { t } = useTranslation();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [caption, setCaption] = useState(restore?.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [captionBand, setCaptionBand] = useState(true);
  const [beforeCleanup, setBeforeCleanup] = useState<{
    caption: string;
    notes: Note[];
  } | null>(null);
  const fields = useRef(new Map<string, HTMLInputElement>());
  const lastField = useRef<string>("caption");
  // Pins, numbered shapes and their notes. A placed pin's note gets focus;
  // a selected or new number becomes the dictation target.
  const {
    notes,
    setNotes,
    setNote,
    pinMode,
    armPin,
    numberShapes,
    toggleNumberShapes,
    selectedPin,
    selectPin,
    removePin,
    handleChange,
  } = usePins(api, {
    scale: crop.scale,
    initialNotes: restore?.notes,
    onPlaced: (pinId) => {
      lastField.current = pinId;
      setTimeout(
        () => fields.current.get(pinId)?.focus({ preventScroll: true }),
        0,
      );
    },
    onActive: (pinId) => (lastField.current = pinId),
  });

  // Size the panel around the screenshot, within the screen.
  const box = useMemo(() => {
    const cssW = crop.width / crop.scale;
    const cssH = crop.height / crop.scale;
    return {
      width: Math.min(Math.max(cssW + 48, 720), window.innerWidth * 0.94),
      height: Math.min(Math.max(cssH + 110, 320), window.innerHeight * 0.62),
    };
  }, [crop]);

  const initialData = useMemo(
    () => ({
      elements:
        restore?.elements ??
        convertToExcalidrawElements([
          {
            type: "image",
            fileId: FILE_ID,
            x: 0,
            y: 0,
            width: crop.width,
            height: crop.height,
            locked: true,
          },
        ] as Skeleton),
      files: {
        [FILE_ID]: {
          id: FILE_ID,
          dataURL: crop.dataURL as BinaryFileData["dataURL"],
          mimeType: "image/png" as BinaryFileData["mimeType"],
          created: Date.now(),
        },
      },
      appState: {
        viewBackgroundColor: "#ffffff",
        currentItemStrokeColor: PIN_COLOR,
        currentItemStrokeWidth: Math.max(2, Math.round(2 * crop.scale)),
        currentItemRoughness: 0,
        currentItemFontFamily: FONT_FAMILY.Helvetica,
        currentItemFontSize: Math.round(20 * crop.scale),
      },
      scrollToContent: true,
    }),
    // Only the first render's restore matters; Excalidraw owns the scene after.
    [crop],
  );

  useEffect(() => {
    if (api)
      setTimeout(
        () => api.scrollToContent(undefined, { fitToContent: true }),
        50,
      );
  }, [api]);

  useEffect(() => {
    invoke<{ captionBand: boolean }>("vibe_capture_settings_get")
      .then((o) => setCaptionBand(o.captionBand))
      .catch(() => undefined);
  }, []);

  // Focus the caption without letting the browser scroll the frozen frame,
  // and undo any scroll a focused field triggers later.
  useEffect(() => {
    fields.current.get("caption")?.focus({ preventScroll: true });
    const pin = () => {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    };
    window.addEventListener("scroll", pin, true);
    return () => window.removeEventListener("scroll", pin, true);
  }, []);

  // Dictation (Ctrl+Space) lands in the last focused field instead of being pasted.
  useEffect(() => {
    const unlisten = listen<string>("vibe://dictation", ({ payload }) => {
      const key = lastField.current;
      const el = fields.current.get(key);
      const current =
        key === "caption"
          ? caption
          : (notes.find((n) => n.pinId === key)?.text ?? "");
      const at =
        el && document.activeElement === el
          ? (el.selectionStart ?? current.length)
          : current.length;
      const before = current.slice(0, at);
      const sep = before && !/\s$/.test(before) ? " " : "";
      const next = `${before}${sep}${payload.trim()}${current.slice(at)}`;
      if (key === "caption") setCaption(next);
      else
        setNotes((ns) =>
          ns.map((n) => (n.pinId === key ? { ...n, text: next } : n)),
        );
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [caption, notes]);

  const cleanup = useCallback(async () => {
    if (cleaning) return;
    setCleaning(true);
    setError(null);
    try {
      const result = await cleanupText(
        caption,
        notes.map((n) => n.text),
      );
      setBeforeCleanup({ caption, notes });
      setCaption(result.caption);
      setNotes((ns) =>
        ns.map((n, i) => ({ ...n, text: result.notes[i] ?? n.text })),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setCleaning(false);
    }
  }, [cleaning, caption, notes]);

  const undoCleanup = useCallback(() => {
    if (!beforeCleanup) return;
    setCaption(beforeCleanup.caption);
    setNotes((ns) =>
      ns.map((n) => beforeCleanup.notes.find((b) => b.pinId === n.pinId) ?? n),
    );
    setBeforeCleanup(null);
  }, [beforeCleanup]);

  const exportPng = useCallback(async (): Promise<Uint8Array> => {
    if (!api) throw new Error("Editor not ready");
    const shot = await exportToBlob({
      elements: api.getSceneElements(),
      files: api.getFiles(),
      appState: {
        exportBackground: true,
        viewBackgroundColor: "#ffffff",
        exportWithDarkMode: false,
      },
      mimeType: "image/png",
      exportPadding: 0,
    });
    const image = await createImageBitmap(shot);

    // Caption band under the image, so it makes sense even without the text.
    const lines = formatText(
      caption,
      notes.map((n) => n.text),
    )
      .split("\n")
      .filter(Boolean);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const font = Math.round(15 * crop.scale);
    const pad = Math.round(12 * crop.scale);
    const lineH = Math.round(font * 1.45);
    ctx.font = `${font}px "Segoe UI", system-ui, sans-serif`;
    const maxW = Math.max(image.width - pad * 2, 100);
    const wrapped: string[] = [];
    for (const line of lines) {
      let cur = "";
      for (const word of line.split(" ")) {
        const test = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(test).width > maxW && cur) {
          wrapped.push(cur);
          cur = word;
        } else cur = test;
      }
      wrapped.push(cur);
    }
    const band =
      captionBand && wrapped.length ? pad * 2 + wrapped.length * lineH : 0;
    canvas.width = Math.max(image.width, 1);
    canvas.height = image.height + band;
    ctx.drawImage(image, 0, 0);
    if (band) {
      ctx.fillStyle = "#1b1512";
      ctx.fillRect(0, image.height, canvas.width, band);
      ctx.fillStyle = "#f1e6d6";
      ctx.font = `${font}px "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "top";
      wrapped.forEach((l, i) =>
        ctx.fillText(l, pad, image.height + pad + i * lineH),
      );
    }
    const blob = await new Promise<Blob | null>((r) =>
      canvas.toBlob(r, "image/png"),
    );
    if (!blob) throw new Error("PNG export failed");
    return new Uint8Array(await blob.arrayBuffer());
  }, [api, caption, notes, crop.scale, captionBand]);

  const send = useCallback(
    async (mode: SendMode, submit: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const png = await exportPng();
        const scene: SavedScene = {
          v: 1,
          crop,
          elements: api?.getSceneElements() ?? [],
          caption,
          notes,
        };
        await sendCapture(
          png,
          formatText(
            caption,
            notes.map((n) => n.text),
          ),
          mode,
          submit,
          JSON.stringify(scene),
        );
      } catch (e) {
        setError(String(e));
        setBusy(false);
      }
    },
    [busy, exportPng, crop, api, caption, notes],
  );

  // Keys: Ctrl+Enter send, Ctrl+Shift+Enter send + submit, Alt+C copy,
  // Alt+Enter board, Alt+` pin, Esc cancel. Plain Enter only moves to the next
  // field. Excalidraw keeps its own keys while its canvas has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as Element | null;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (isPinKey(e)) {
        handled();
        armPin();
        return;
      }
      if (el?.closest?.(".excalidraw-wysiwyg")) return;
      if (e.ctrlKey && e.key === "k") {
        handled();
        cleanup();
      } else if (e.altKey && !e.ctrlKey && !e.shiftKey && e.code === "KeyC") {
        handled();
        send("copyOnly", false);
      } else if (e.key === "Enter" && e.ctrlKey) {
        handled();
        if (target) send("send", e.shiftKey);
      } else if (e.key === "Enter" && e.altKey) {
        handled();
        send("board", false);
      } else if (e.key === "Enter" && isTextField(el)) {
        handled();
        const order = ["caption", ...notes.map((n) => n.pinId)];
        const at = order.findIndex((k) => fields.current.get(k) === el);
        const next = order[at + 1];
        if (next) fields.current.get(next)?.focus({ preventScroll: true });
      } else if (e.key === "Escape") {
        const selected =
          api && Object.keys(api.getAppState().selectedElementIds).length > 0;
        if (pinMode) armPin(false);
        else if (!selected) closeCapture();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [api, send, cleanup, armPin, pinMode, notes, target]);

  const bindField = (key: string) => (el: HTMLInputElement | null) => {
    if (el) fields.current.set(key, el);
    else fields.current.delete(key);
  };

  return (
    <div
      className="vibe-editor"
      style={{ width: box.width }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div
        className={`vibe-canvas${pinMode ? " pin-armed" : ""}`}
        style={{ height: box.height }}
      >
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          onChange={handleChange}
          handleKeyboardGlobally={false}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              clearCanvas: false,
              export: false,
              loadScene: false,
              saveAsImage: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
            tools: { image: false },
          }}
          renderTopRightUI={() => (
            <PinTools
              pinMode={pinMode}
              numberShapes={numberShapes}
              onPin={() => armPin()}
              onToggleNumbers={toggleNumberShapes}
            />
          )}
        />
      </div>
      <div className="vibe-panel">
        <div className="vibe-row">
          <input
            ref={bindField("caption")}
            className="vibe-input"
            value={caption}
            placeholder={t("vibe.capture.captionPlaceholder")}
            onFocus={() => (lastField.current = "caption")}
            onChange={(e) => setCaption(e.target.value)}
          />
          {beforeCleanup ? (
            <button type="button" className="vibe-btn" onClick={undoCleanup}>
              {t("vibe.capture.undoCleanup")}
            </button>
          ) : (
            <button
              type="button"
              className="vibe-btn"
              disabled={cleaning}
              onClick={cleanup}
            >
              {SPARKLE}{" "}
              {cleaning
                ? t("vibe.capture.cleaning")
                : t("vibe.capture.cleanup")}
              <kbd>{KEYS.cleanup}</kbd>
            </button>
          )}
        </div>
        {notes.map((note, i) => (
          <PinNoteRow
            key={note.pinId}
            note={note}
            index={i}
            active={selectedPin === note.pinId}
            inputRef={bindField(note.pinId)}
            onFocus={() => {
              lastField.current = note.pinId;
              selectPin(note.pinId);
            }}
            onText={(text) => setNote(note.pinId, text)}
            onRemove={() => {
              removePin(note.pinId);
              fields.current.get("caption")?.focus({ preventScroll: true });
            }}
          />
        ))}
      </div>
      <div className="vibe-foot">
        {error ? (
          <span className="vibe-error">
            {t("vibe.capture.error", { error })}
          </span>
        ) : (
          <span>
            {pinMode
              ? t("vibe.capture.pinHint")
              : busy
                ? t("vibe.capture.sending")
                : !target
                  ? t("vibe.capture.noTarget")
                  : selectedPin
                    ? t("vibe.capture.pinTip")
                    : t("vibe.capture.copyHint")}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="vibe-btn"
          onClick={() => closeCapture()}
        >
          {t("vibe.capture.cancel")}
          <kbd>{KEYS.cancel}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn"
          disabled={busy}
          onClick={() => send("board", false)}
        >
          {t("vibe.capture.toBoard")}
          <kbd>{KEYS.board}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn"
          disabled={busy}
          onClick={() => send("copyOnly", false)}
        >
          {t("vibe.capture.copy")}
          <kbd>{KEYS.copy}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn"
          disabled={busy || !target}
          onClick={() => send("send", true)}
        >
          {t("vibe.capture.sendSubmit")}
          <kbd>{KEYS.sendSubmit}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn primary"
          disabled={busy || !target}
          title={target?.title}
          onClick={() => send("send", false)}
        >
          {target
            ? t("vibe.capture.sendTo", { app: target.app })
            : t("vibe.capture.send")}
          <kbd>{KEYS.send}</kbd>
        </button>
      </div>
    </div>
  );
}
