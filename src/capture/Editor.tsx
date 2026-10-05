import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  CaptureUpdateAction,
  Excalidraw,
  FONT_FAMILY,
  convertToExcalidrawElements,
  exportToBlob,
} from "@excalidraw/excalidraw";
import type {
  AppState,
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

export interface Note {
  pinId: string;
  text: string;
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

const PIN_COLOR = "#ff3b7f";
// Key names and symbols, not translatable text.
// Plain Enter never sends: it's too easy to hit by accident.
const KEYS = {
  cleanup: "Ctrl+K",
  pin: "Alt+`",
  cancel: "Esc",
  copy: "Alt+C",
  board: "Alt+Enter",
  sendSubmit: "Ctrl+Shift+Enter",
  send: "Ctrl+Enter",
} as const;
const PIN_ICON = "①";
const SPARKLE = "✨";
const REMOVE = "×";
const FILE_ID = "vibe-capture" as FileId;
const isTextField = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;

const NUMBER_ICON = "#";
const PIN_TOOL = "vibe-pin";
// Shapes that get a number while "Number shapes" is on. Text is left alone:
// it's already a note.
const NUMBERED_TYPES = new Set([
  "rectangle",
  "ellipse",
  "diamond",
  "arrow",
  "line",
  "freedraw",
]);
const NUMBER_SHAPES_KEY = "vibe.numberShapes";

const isPin = (e: { customData?: Record<string, unknown> }) =>
  Boolean(e.customData?.vibePin);
const isPinTool = (tool: AppState["activeTool"]) =>
  tool.type === "custom" && tool.customType === PIN_TOOL;
const randomId = () => Math.random().toString(36).slice(2, 12);

/** Where a shape's number sits: its top-left corner, or a line's start. */
function anchorOf(e: ExcalidrawElement): { x: number; y: number } {
  if ("points" in e && e.points.length > 0)
    return { x: e.x + e.points[0][0], y: e.y + e.points[0][1] };
  return { x: e.x, y: e.y };
}

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
  const [notes, setNotes] = useState<Note[]>(restore?.notes ?? []);
  // Pin is a one-shot canvas tool: the next click places one numbered marker,
  // then the editor goes back to the pointer so pins can be moved and deleted.
  const [pinMode, setPinMode] = useState(false);
  // While on, every shape drawn gets the next number (grouped with it).
  const [numberShapes, setNumberShapes] = useState(
    () => localStorage.getItem(NUMBER_SHAPES_KEY) !== "off",
  );
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
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
  const pinModeRef = useRef(pinMode);
  pinModeRef.current = pinMode;
  const numberShapesRef = useRef(numberShapes);
  numberShapesRef.current = numberShapes;
  // Note text of deleted pins, so undoing a delete brings its note back.
  const removedText = useRef(new Map<string, string>());
  // Elements already seen, so only newly drawn shapes get numbered (not ones
  // brought back by undo, or drawn while numbering was off).
  const known = useRef<Set<string> | null>(null);

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

  // A custom Excalidraw tool, so the click doesn't also select or draw.
  const armPin = useCallback(
    (on?: boolean) => {
      const next = on ?? !pinModeRef.current;
      setPinMode(next);
      api?.setActiveTool(
        next ? { type: "custom", customType: PIN_TOOL } : { type: "selection" },
      );
    },
    [api],
  );

  const toggleNumberShapes = useCallback(() => {
    setNumberShapes((on) => {
      localStorage.setItem(NUMBER_SHAPES_KEY, on ? "off" : "on");
      return !on;
    });
  }, []);

  /** A numbered badge (circle + label) centred on a point. Numbers are kept
   *  in order by the renumbering effect below. */
  const makeBadge = useCallback(
    (x: number, y: number, n: number, groupId?: string) => {
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
      for (const e of created) known.current?.add(e.id);
      return groupId
        ? created.map((e) => ({ ...e, groupIds: [groupId] }))
        : created;
    },
    [crop.scale],
  );

  const addPin = useCallback(
    (x: number, y: number) => {
      if (!api) return;
      const n = api.getSceneElements().filter(isPin).length + 1;
      const created = makeBadge(x, y, n);
      api.updateScene({
        elements: [...api.getSceneElements(), ...created],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      armPin(false);
      const pinId = created[0].id;
      lastField.current = pinId;
      setTimeout(
        () => fields.current.get(pinId)?.focus({ preventScroll: true }),
        0,
      );
    },
    [api, makeBadge, armPin],
  );

  // Drop a pin where the user clicks while the Pin tool is armed.
  useEffect(() => {
    if (!api) return;
    return api.onPointerDown((tool, state) => {
      if (isPinTool(tool)) addPin(state.origin.x, state.origin.y);
    });
  }, [api, addPin]);

  // Give newly drawn shapes the next number, grouped with the shape so they
  // move and delete together. Focus stays on the canvas, so tool keys keep
  // working; dictation goes to the new shape's note.
  const numberNewShapes = useCallback(
    (shapes: ExcalidrawElement[]) => {
      if (!api || shapes.length === 0) return;
      const ids = new Set(shapes.map((s) => s.id));
      const groups = new Map(shapes.map((s) => [s.id, randomId()]));
      const count = api.getSceneElements().filter(isPin).length;
      const badges = shapes.flatMap((s, i) => {
        const at = anchorOf(s);
        return makeBadge(at.x, at.y, count + i + 1, groups.get(s.id));
      });
      api.updateScene({
        elements: [
          ...api.getSceneElements().map((e) =>
            ids.has(e.id)
              ? {
                  ...e,
                  groupIds: [groups.get(e.id) ?? randomId()],
                  version: e.version + 1,
                  versionNonce: Math.floor(Math.random() * 2 ** 31),
                  updated: Date.now(),
                }
              : e,
          ),
          ...badges,
        ],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      const last = badges.filter(isPin).pop();
      if (last) lastField.current = last.id;
    },
    [api, makeBadge],
  );

  const removePin = useCallback(
    (pinId: string) => {
      if (!api) return;
      api.updateScene({
        elements: api
          .getSceneElements()
          .filter(
            (e) =>
              e.id !== pinId && !(e.type === "text" && e.containerId === pinId),
          ),
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      fields.current.get("caption")?.focus({ preventScroll: true });
    },
    [api],
  );

  // Notes follow the pins on the canvas: deleting a pin (Delete key, the x
  // button) drops its note and renumbers the rest; undo brings both back.
  // Selecting a pin highlights its note and points dictation at it.
  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      const armed = isPinTool(appState.activeTool);
      setPinMode((cur) => (cur === armed ? cur : armed));

      const pins = elements.filter((e) => !e.isDeleted && isPin(e));
      if (!known.current) known.current = new Set(elements.map((e) => e.id));
      // Wait until a shape is finished before numbering it.
      if (!appState.newElement && !appState.multiElement) {
        const fresh = elements.filter(
          (e) => !e.isDeleted && !known.current?.has(e.id),
        );
        for (const e of fresh) known.current.add(e.id);
        // Grouped shapes are skipped: copies of numbered shapes bring their
        // own number, and the user's own groups are left as they are.
        const shapes = numberShapesRef.current
          ? fresh.filter(
              (e) =>
                NUMBERED_TYPES.has(e.type) &&
                !isPin(e) &&
                e.groupIds.length === 0,
            )
          : [];
        // Not inside Excalidraw's change callback.
        if (shapes.length) setTimeout(() => numberNewShapes(shapes), 0);
      }
      setNotes((ns) => {
        if (
          ns.length === pins.length &&
          ns.every((n, i) => n.pinId === pins[i].id)
        )
          return ns;
        const text = new Map(ns.map((n) => [n.pinId, n.text]));
        for (const n of ns)
          if (!pins.some((p) => p.id === n.pinId))
            removedText.current.set(n.pinId, n.text);
        return pins.map((p) => ({
          pinId: p.id,
          text: text.get(p.id) ?? removedText.current.get(p.id) ?? "",
        }));
      });
      // Selecting a numbered shape selects its group, number included.
      const chosen = pins.filter((p) => appState.selectedElementIds[p.id]);
      const pin = chosen.length === 1 ? chosen[0].id : null;
      setSelectedPin((cur) => (cur === pin ? cur : pin));
      if (pin) lastField.current = pin;
    },
    [numberNewShapes],
  );

  const focusNote = useCallback(
    (pinId: string) => {
      lastField.current = pinId;
      api?.updateScene({
        appState: { selectedElementIds: { [pinId]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [api],
  );

  useEffect(() => {
    if (!api) return;
    const order = new Map(notes.map((n, i) => [n.pinId, String(i + 1)]));
    const scene = api.getSceneElements();
    const stale = scene.filter(
      (e) =>
        e.type === "text" &&
        e.containerId &&
        order.has(e.containerId) &&
        e.text !== order.get(e.containerId),
    );
    if (stale.length === 0) return;
    api.updateScene({
      elements: scene.map((e) => {
        if (e.type !== "text" || !e.containerId || !order.has(e.containerId))
          return e;
        const text = order.get(e.containerId) ?? e.text;
        if (text === e.text) return e;
        return {
          ...e,
          text,
          originalText: text,
          version: e.version + 1,
          versionNonce: Math.floor(Math.random() * 2 ** 31),
          updated: Date.now(),
        };
      }),
    });
  }, [api, notes]);

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
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, image.height, canvas.width, band);
      ctx.fillStyle = "#f3f4f6";
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
      // e.code, so the key is the same on every keyboard layout.
      if (e.altKey && e.code === "Backquote") {
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
        if (pinModeRef.current) armPin(false);
        else if (!selected) closeCapture();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [api, send, cleanup, armPin, notes, target]);

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
          renderTopRightUI={() => (
            <div className="vibe-tools">
              <button
                type="button"
                className={`vibe-tool${pinMode ? " on" : ""}`}
                title={t("vibe.capture.pinHint")}
                onClick={() => armPin()}
              >
                {PIN_ICON} {t("vibe.capture.pin")}
                <kbd>{KEYS.pin}</kbd>
              </button>
              <button
                type="button"
                className={`vibe-tool${numberShapes ? " on" : ""}`}
                title={t("vibe.capture.numberShapesHint")}
                aria-pressed={numberShapes}
                onClick={toggleNumberShapes}
              >
                {NUMBER_ICON} {t("vibe.capture.numberShapes")}
              </button>
            </div>
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
          <div
            className={`vibe-row${selectedPin === note.pinId ? " active" : ""}`}
            key={note.pinId}
          >
            <span className="vibe-pin">{i + 1}</span>
            <input
              ref={bindField(note.pinId)}
              className="vibe-input"
              value={note.text}
              placeholder={t("vibe.capture.notePlaceholder", { n: i + 1 })}
              onFocus={() => focusNote(note.pinId)}
              onChange={(e) =>
                setNotes((ns) =>
                  ns.map((n) =>
                    n.pinId === note.pinId ? { ...n, text: e.target.value } : n,
                  ),
                )
              }
            />
            <button
              type="button"
              className="vibe-btn vibe-remove"
              title={t("vibe.capture.removePin", { n: i + 1 })}
              aria-label={t("vibe.capture.removePin", { n: i + 1 })}
              onClick={() => removePin(note.pinId)}
            >
              {REMOVE}
            </button>
          </div>
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
                  : notes.length > 0
                    ? t("vibe.capture.pinTip")
                    : ""}
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
