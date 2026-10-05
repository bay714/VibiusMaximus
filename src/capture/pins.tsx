// Numbered pins on an Excalidraw canvas, shared by the capture editor and the
// board: the one-shot Pin tool (Alt+`), "Number shapes" (every new shape gets
// the next number, grouped with it), notes that follow the pins, and
// renumbering when one is deleted.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CaptureUpdateAction,
  FONT_FAMILY,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export interface Note {
  pinId: string;
  text: string;
}

type Skeleton = Parameters<typeof convertToExcalidrawElements>[0];

export const PIN_COLOR = "#c0392b";
// Symbols, not translatable text.
const PIN_ICON = "①";
const NUMBER_ICON = "#";
const REMOVE = "×";
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

export const isPin = (e: { customData?: Record<string, unknown> }) =>
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

export function usePins(
  api: ExcalidrawImperativeAPI | null,
  {
    scale = 1,
    initialNotes = [],
    onPlaced,
    onActive,
  }: {
    /** Scene units per CSS pixel, so badges look the same size everywhere. */
    scale?: number;
    initialNotes?: Note[];
    /** A pin was placed with the Pin tool (e.g. focus its note). */
    onPlaced?: (pinId: string) => void;
    /** A pin was selected or a shape was numbered (e.g. aim dictation at it). */
    onActive?: (pinId: string) => void;
  } = {},
) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [pinMode, setPinMode] = useState(false);
  const [numberShapes, setNumberShapes] = useState(
    () => localStorage.getItem(NUMBER_SHAPES_KEY) !== "off",
  );
  const [selectedPin, setSelectedPin] = useState<string | null>(null);
  const pinModeRef = useRef(pinMode);
  pinModeRef.current = pinMode;
  const numberShapesRef = useRef(numberShapes);
  numberShapesRef.current = numberShapes;
  const callbacks = useRef({ onPlaced, onActive });
  callbacks.current = { onPlaced, onActive };
  // Note text of deleted pins, so undoing a delete brings its note back.
  const removedText = useRef(new Map<string, string>());
  // Elements already seen, so only newly drawn shapes get numbered (not ones
  // brought back by undo, or drawn while numbering was off).
  const known = useRef<Set<string> | null>(null);

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
      // Big enough that Excalidraw doesn't stretch the circle to fit a
      // two-digit label with its padding.
      const size = Math.round(36 * scale);
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
            fontSize: Math.round(13 * scale),
            fontFamily: FONT_FAMILY.Helvetica,
          },
        },
      ] as Skeleton);
      for (const e of created) known.current?.add(e.id);
      return groupId
        ? created.map((e) => ({ ...e, groupIds: [groupId] }))
        : created;
    },
    [scale],
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
      callbacks.current.onPlaced?.(created[0].id);
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
  // working.
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
      if (last) callbacks.current.onActive?.(last.id);
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
    },
    [api],
  );

  /** Select a pin on the canvas (when its note is focused). */
  const selectPin = useCallback(
    (pinId: string) => {
      api?.updateScene({
        appState: { selectedElementIds: { [pinId]: true } },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [api],
  );

  const setNote = useCallback((pinId: string, text: string) => {
    setNotes((ns) => ns.map((n) => (n.pinId === pinId ? { ...n, text } : n)));
  }, []);

  /** Call from Excalidraw's onChange. Notes follow the pins on the canvas:
   *  deleting a pin drops its note and renumbers the rest; undo brings both
   *  back. */
  const handleChange = useCallback(
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
        // Boards keep each note on its pin (customData.note) between sessions.
        return pins.map((p) => ({
          pinId: p.id,
          text:
            text.get(p.id) ??
            removedText.current.get(p.id) ??
            (typeof p.customData?.note === "string" ? p.customData.note : ""),
        }));
      });
      // Selecting a numbered shape selects its group, number included.
      const chosen = pins.filter((p) => appState.selectedElementIds[p.id]);
      const pin = chosen.length === 1 ? chosen[0].id : null;
      setSelectedPin((cur) => (cur === pin ? cur : pin));
      if (pin) callbacks.current.onActive?.(pin);
    },
    [numberNewShapes],
  );

  // Keep the numbers on the canvas in note order.
  useEffect(() => {
    if (!api) return;
    const order = new Map(notes.map((n, i) => [n.pinId, String(i + 1)]));
    const scene = api.getSceneElements();
    const stale = scene.some(
      (e) =>
        e.type === "text" &&
        e.containerId &&
        order.has(e.containerId) &&
        e.text !== order.get(e.containerId),
    );
    if (!stale) return;
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

  return {
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
  };
}

/** Pin and Number shapes buttons, for Excalidraw's renderTopRightUI. */
export function PinTools({
  pinMode,
  numberShapes,
  onPin,
  onToggleNumbers,
  pinKey,
  numberKey,
}: {
  pinMode: boolean;
  numberShapes: boolean;
  onPin: () => void;
  onToggleNumbers: () => void;
  pinKey: string;
  numberKey: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="vibe-tools">
      <button
        type="button"
        className={`vibe-tool${pinMode ? " on" : ""}`}
        title={t("vibe.capture.pinHint")}
        onClick={onPin}
      >
        {PIN_ICON} {t("vibe.capture.pin")}
        <kbd>{pinKey}</kbd>
      </button>
      <button
        type="button"
        className={`vibe-tool${numberShapes ? " on" : ""}`}
        title={t("vibe.capture.numberShapesHint")}
        aria-pressed={numberShapes}
        onClick={onToggleNumbers}
      >
        {NUMBER_ICON} {t("vibe.capture.numberShapes")}
        <kbd>{numberKey}</kbd>
      </button>
    </div>
  );
}

/** One note row: the pin's number, its text, and a remove button. */
export function PinNoteRow({
  note,
  index,
  active,
  inputRef,
  onFocus,
  onText,
  onRemove,
}: {
  note: Note;
  index: number;
  active: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
  onFocus: () => void;
  onText: (text: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const n = index + 1;
  return (
    <div className={`vibe-row${active ? " active" : ""}`}>
      <span className="vibe-pin">{n}</span>
      <input
        ref={inputRef}
        className="vibe-input"
        value={note.text}
        placeholder={t("vibe.capture.notePlaceholder", { n })}
        onFocus={onFocus}
        onChange={(e) => onText(e.target.value)}
      />
      <button
        type="button"
        className="vibe-btn vibe-remove"
        title={t("vibe.capture.removePin", { n })}
        aria-label={t("vibe.capture.removePin", { n })}
        onClick={onRemove}
      >
        {REMOVE}
      </button>
    </div>
  );
}
