import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import {
  Excalidraw,
  FONT_FAMILY,
  convertToExcalidrawElements,
  exportToBlob,
} from "@excalidraw/excalidraw";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import { closeCapture, formatText, sendCapture, type SendMode } from "./api";

// Fonts are bundled under /public/excalidraw so Excalidraw never fetches them
// from a CDN.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH = "/excalidraw/";

export interface Crop {
  dataURL: string;
  /** Physical pixels. */
  width: number;
  height: number;
  /** Physical pixels per CSS pixel. */
  scale: number;
}

interface Note {
  pinId: string;
  text: string;
}

type Skeleton = Parameters<typeof convertToExcalidrawElements>[0];

const PIN_COLOR = "#ff3b7f";
const FILE_ID = "vibe-capture" as FileId;
const isTextField = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

export default function Editor({ crop }: { crop: Crop }) {
  const { t } = useTranslation();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [caption, setCaption] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = useRef(new Map<string, HTMLInputElement>());
  const lastField = useRef<string>("caption");
  const pinModeRef = useRef(pinMode);
  pinModeRef.current = pinMode;

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
      elements: convertToExcalidrawElements([
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
    [crop],
  );

  useEffect(() => {
    if (api) setTimeout(() => api.scrollToContent(undefined, { fitToContent: true }), 50);
  }, [api]);

  // Dictation (Ctrl+Space) lands in the last focused field instead of being pasted.
  useEffect(() => {
    const unlisten = listen<string>("vibe://dictation", ({ payload }) => {
      const key = lastField.current;
      const el = fields.current.get(key);
      const current = key === "caption" ? caption : (notes.find((n) => n.pinId === key)?.text ?? "");
      const at = el && document.activeElement === el ? (el.selectionStart ?? current.length) : current.length;
      const before = current.slice(0, at);
      const sep = before && !/\s$/.test(before) ? " " : "";
      const next = `${before}${sep}${payload.trim()}${current.slice(at)}`;
      if (key === "caption") setCaption(next);
      else setNotes((ns) => ns.map((n) => (n.pinId === key ? { ...n, text: next } : n)));
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [caption, notes]);

  const addPin = useCallback(
    (x: number, y: number) => {
      if (!api) return;
      const n = notes.length + 1;
      const size = Math.round(28 * crop.scale);
      const created = convertToExcalidrawElements([
        {
          type: "ellipse",
          x: x - size / 2,
          y: y - size / 2,
          width: size,
          height: size,
          backgroundColor: PIN_COLOR,
          strokeColor: "#ffffff",
          fillStyle: "solid",
          strokeWidth: 2,
          roughness: 0,
          customData: { vibePin: true },
          label: {
            text: String(n),
            strokeColor: "#ffffff",
            fontSize: Math.round(15 * crop.scale),
            fontFamily: FONT_FAMILY.Helvetica,
          },
        },
      ] as Skeleton);
      api.updateScene({ elements: [...api.getSceneElements(), ...created] });
      const pinId = created[0].id;
      setNotes((ns) => [...ns, { pinId, text: "" }]);
      lastField.current = pinId;
      setTimeout(() => fields.current.get(pinId)?.focus(), 0);
    },
    [api, crop.scale, notes.length],
  );

  // Drop a pin where the user clicks while Pin mode is on.
  useEffect(() => {
    if (!api) return;
    return api.onPointerDown((_tool, state) => {
      if (pinModeRef.current) addPin(state.origin.x, state.origin.y);
    });
  }, [api, addPin]);

  // A deleted pin removes its note.
  const onChange = useCallback(
    (elements: readonly { id: string; isDeleted: boolean; customData?: Record<string, unknown> }[]) => {
      const live = new Set(
        elements.filter((e) => !e.isDeleted && e.customData?.vibePin).map((e) => e.id),
      );
      setNotes((ns) => (ns.every((n) => live.has(n.pinId)) ? ns : ns.filter((n) => live.has(n.pinId))));
    },
    [],
  );

  const exportPng = useCallback(async (): Promise<Uint8Array> => {
    if (!api) throw new Error("Editor not ready");
    const shot = await exportToBlob({
      elements: api.getSceneElements(),
      files: api.getFiles(),
      appState: { exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false },
      mimeType: "image/png",
      exportPadding: 0,
    });
    const image = await createImageBitmap(shot);

    // Caption band under the image, so it makes sense even without the text.
    const lines = formatText(caption, notes.map((n) => n.text)).split("\n").filter(Boolean);
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
    const band = wrapped.length ? pad * 2 + wrapped.length * lineH : 0;
    canvas.width = Math.max(image.width, 1);
    canvas.height = image.height + band;
    ctx.drawImage(image, 0, 0);
    if (band) {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, image.height, canvas.width, band);
      ctx.fillStyle = "#f3f4f6";
      ctx.font = `${font}px "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "top";
      wrapped.forEach((l, i) => ctx.fillText(l, pad, image.height + pad + i * lineH));
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("PNG export failed");
    return new Uint8Array(await blob.arrayBuffer());
  }, [api, caption, notes, crop.scale]);

  const send = useCallback(
    async (mode: SendMode, submit: boolean) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const png = await exportPng();
        await sendCapture(png, formatText(caption, notes.map((n) => n.text)), mode, submit);
      } catch (e) {
        setError(String(e));
        setBusy(false);
      }
    },
    [busy, exportPng, caption, notes],
  );

  // Keys: Enter send, Ctrl+Enter send + submit, Shift+Enter copy, Esc cancel,
  // Alt+P pin mode. Excalidraw keeps its own keys while its canvas has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as Element | null;
      const inExcalidrawText = target?.closest?.(".excalidraw-wysiwyg");
      if (e.key === "p" && e.altKey) {
        e.preventDefault();
        setPinMode((p) => !p);
        return;
      }
      if (inExcalidrawText) return;
      if (e.key === "Enter" && (isTextField(target) || target === document.body)) {
        e.preventDefault();
        if (e.shiftKey) send("copyOnly", false);
        else send("send", e.ctrlKey);
      } else if (e.key === "Escape") {
        const selected = api && Object.keys(api.getAppState().selectedElementIds).length > 0;
        if (!selected && !pinModeRef.current) closeCapture();
        else if (pinModeRef.current) setPinMode(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [api, send]);

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
      <div className="vibe-canvas" style={{ height: box.height }}>
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          onChange={onChange}
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
        />
      </div>
      <div className="vibe-panel">
        <div className="vibe-row">
          <input
            ref={bindField("caption")}
            className="vibe-input"
            autoFocus
            value={caption}
            placeholder={t("vibe.capture.captionPlaceholder")}
            onFocus={() => (lastField.current = "caption")}
            onChange={(e) => setCaption(e.target.value)}
          />
          <button
            type="button"
            className={`vibe-btn${pinMode ? " on" : ""}`}
            title={t("vibe.capture.pinHint")}
            onClick={() => setPinMode((p) => !p)}
          >
            ① {t("vibe.capture.pin")}
            <kbd>Alt+P</kbd>
          </button>
        </div>
        {notes.map((note, i) => (
          <div className="vibe-row" key={note.pinId}>
            <span className="vibe-pin">{i + 1}</span>
            <input
              ref={bindField(note.pinId)}
              className="vibe-input"
              value={note.text}
              placeholder={t("vibe.capture.notePlaceholder", { n: i + 1 })}
              onFocus={() => (lastField.current = note.pinId)}
              onChange={(e) =>
                setNotes((ns) =>
                  ns.map((n) => (n.pinId === note.pinId ? { ...n, text: e.target.value } : n)),
                )
              }
            />
          </div>
        ))}
      </div>
      <div className="vibe-foot">
        {error ? (
          <span className="vibe-error">{t("vibe.capture.error", { error })}</span>
        ) : (
          <span>{pinMode ? t("vibe.capture.pinHint") : busy ? t("vibe.capture.sending") : ""}</span>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" className="vibe-btn" onClick={() => closeCapture()}>
          {t("vibe.capture.cancel")}
          <kbd>Esc</kbd>
        </button>
        <button type="button" className="vibe-btn" disabled={busy} onClick={() => send("copyOnly", false)}>
          {t("vibe.capture.copy")}
          <kbd>Shift+Enter</kbd>
        </button>
        <button type="button" className="vibe-btn" disabled={busy} onClick={() => send("send", true)}>
          {t("vibe.capture.sendSubmit")}
          <kbd>Ctrl+Enter</kbd>
        </button>
        <button type="button" className="vibe-btn primary" disabled={busy} onClick={() => send("send", false)}>
          {t("vibe.capture.send")}
          <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
