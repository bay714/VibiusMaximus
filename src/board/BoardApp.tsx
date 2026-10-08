import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Excalidraw,
  FONT_FAMILY,
  convertToExcalidrawElements,
  exportToBlob,
  serializeAsJSON,
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
import { compile, intersects, type Box } from "./compile";
import {
  PinNoteRow,
  PinTools,
  isPin,
  usePins,
  type Note,
} from "../capture/pins";
import { matches, showKey, useKeys } from "../capture/keys";
import { BoardsPanel, type BoardMeta } from "./BoardsPanel";
import { insertWords, wrap } from "./dictation";

// Fonts are bundled under /public/excalidraw so Excalidraw never fetches them.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
  "/excalidraw/";

type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>;
type InitialData = { elements?: unknown; files?: unknown; appState?: unknown };

/** The open board: its details and the scene to start from. */
interface OpenBoard {
  meta: BoardMeta;
  initial: InitialData;
}

/** A preview is refreshed at most this often while editing. */
const THUMB_EVERY_MS = 20_000;

function toOpenBoard(loaded: {
  meta: BoardMeta;
  scene: string | null;
}): OpenBoard {
  let initial: InitialData = {};
  try {
    if (loaded.scene) initial = JSON.parse(loaded.scene) as InitialData;
  } catch {
    initial = {};
  }
  return { meta: loaded.meta, initial };
}

// Symbol, not translatable text.
const BOARDS_ICON = "☰";
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
/** Imported images are laid out at most this wide on the board. */
const MAX_PLACED_WIDTH = 520;

const toBox = (e: ExcalidrawElement): Box => ({
  id: e.id,
  kind: e.type === "image" ? "image" : e.type === "text" ? "text" : "shape",
  x: e.x,
  y: e.y,
  width: Math.abs(e.width),
  height: Math.abs(e.height),
  text: e.type === "text" ? e.text : undefined,
});

const blobToDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Board elements that make up the prompt: everything except the number
 *  labels inside pins, which would otherwise read as stray "1", "2". */
const promptElements = (elements: readonly ExcalidrawElement[]) => {
  const pins = new Set(elements.filter(isPin).map((e) => e.id));
  return elements.filter(
    (e) => !(e.type === "text" && e.containerId && pins.has(e.containerId)),
  );
};

/** The board's prompt, then each pin's note as "n. note". */
const promptText = (elements: readonly ExcalidrawElement[], notes: Note[]) => {
  const { text } = compile(promptElements(elements).map(toBox));
  const lines = notes
    .map((n, i) => (n.text.trim() ? `${i + 1}. ${n.text.trim()}` : ""))
    .filter(Boolean);
  return [text, ...lines].filter(Boolean).join("\n");
};

const mimeFor = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "png";
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
};

export default function BoardApp() {
  const { t } = useTranslation();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [board, setBoard] = useState<OpenBoard | null>(null);
  const [showBoards, setShowBoards] = useState(false);
  const boardId = useRef<string | null>(null);
  boardId.current = board?.meta.id ?? null;
  const lastThumb = useRef(0);
  const [target, setTarget] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The same keys as the capture editor, from Settings → Hotkeys.
  const keys = useKeys();
  const noteFields = useRef(new Map<string, HTMLInputElement>());
  // The note dictation goes to when no text field has focus: the one placed,
  // selected or typed in last.
  const lastNote = useRef<string | null>(null);
  const {
    notes,
    setNote,
    pinMode,
    armPin,
    numberShapes,
    toggleNumberShapes,
    selectedPin,
    selectPin,
    removePin,
    handleChange,
    reset: resetPins,
  } = usePins(api, {
    onPlaced: (pinId) => {
      lastNote.current = pinId;
      setTimeout(() => noteFields.current.get(pinId)?.focus(), 0);
    },
    onActive: (pinId) => (lastNote.current = pinId),
  });
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Dictation (Ctrl+Space) while the board is in front arrives here instead of
  // as a paste, which could land on the canvas: into the field being edited,
  // else the last pin's note, else a new text box in the middle of the view.
  useEffect(() => {
    const unlisten = listen<string>("vibe://dictation", ({ payload }) => {
      const text = payload.trim();
      if (!text) return;
      const focused = document.activeElement;
      const focusedNote = [...noteFields.current].find(
        ([, field]) => field === focused,
      )?.[0];
      const noteId =
        focusedNote ??
        (focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement
          ? undefined
          : notesRef.current.find((n) => n.pinId === lastNote.current)?.pinId);

      if (noteId) {
        const field = noteFields.current.get(noteId);
        const current =
          notesRef.current.find((n) => n.pinId === noteId)?.text ?? "";
        const at =
          field && field === focused
            ? (field.selectionStart ?? current.length)
            : current.length;
        const next = insertWords(current, at, text);
        setNote(noteId, next.value);
        lastNote.current = noteId;
        requestAnimationFrame(() => {
          field?.focus({ preventScroll: true });
          field?.setSelectionRange(next.caret, next.caret);
        });
      } else if (
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement
      ) {
        // Another field, e.g. a text box being edited on the canvas.
        const at = focused.selectionStart ?? focused.value.length;
        const end = focused.selectionEnd ?? at;
        const { value } = insertWords(focused.value.slice(0, at), at, text);
        focused.setRangeText(value.slice(at), at, end, "end");
        focused.dispatchEvent(new Event("input", { bubbles: true }));
      } else if (api) {
        const view = api.getAppState();
        const x = view.width / 2 / view.zoom.value - view.scrollX - 200;
        const y = view.height / 2 / view.zoom.value - view.scrollY;
        api.updateScene({
          elements: [
            ...api.getSceneElements(),
            ...convertToExcalidrawElements([
              {
                type: "text",
                x,
                y,
                text: wrap(text, 60),
                fontFamily: FONT_FAMILY.Helvetica,
              } as Skeleton[number],
            ]),
          ],
        });
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [api, setNote]);

  useEffect(() => {
    invoke<{ meta: BoardMeta; scene: string | null }>("vibe_board_load")
      .then((loaded) => setBoard(toOpenBoard(loaded)))
      .catch((e) => setStatus(String(e)));
    invoke<string | null>("vibe_board_target").then(setTarget);
  }, []);

  /** A small preview for the board list. */
  const saveThumb = useCallback(
    async (id: string) => {
      if (!api) return;
      const elements = api.getSceneElements();
      if (elements.length === 0) return;
      lastThumb.current = Date.now();
      const blob = await exportToBlob({
        elements,
        files: api.getFiles(),
        appState: { exportBackground: true, viewBackgroundColor: "#ffffff" },
        mimeType: "image/png",
        maxWidthOrHeight: 360,
      });
      const png = new Uint8Array(await blob.arrayBuffer());
      const idBytes = new TextEncoder().encode(id);
      const body = new Uint8Array(4 + idBytes.length + png.length);
      new DataView(body.buffer).setUint32(0, idBytes.length, true);
      body.set(idBytes, 4);
      body.set(png, 4 + idBytes.length);
      await invoke("vibe_board_thumb", body);
    },
    [api],
  );

  /** Save the open board now. Each pin carries its note in customData, so
   *  notes come back with the board. */
  const saveNow = useCallback(
    async (thumb = false) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const id = boardId.current;
      if (!api || !id) return;
      const text = new Map(notesRef.current.map((n) => [n.pinId, n.text]));
      const elements = api.getSceneElements().map((e) =>
        isPin(e)
          ? {
              ...e,
              customData: { ...e.customData, note: text.get(e.id) ?? "" },
            }
          : e,
      );
      const scene = serializeAsJSON(
        elements,
        { viewBackgroundColor: "#ffffff" },
        api.getFiles(),
        "local",
      );
      const images = elements.filter((e) => e.type === "image").length;
      await invoke("vibe_board_save", { id, scene, images });
      if (thumb || Date.now() - lastThumb.current > THUMB_EVERY_MS)
        await saveThumb(id).catch(() => undefined);
    },
    [api, saveThumb],
  );

  // Save shortly after the last change.
  const scheduleSave = useCallback(() => {
    if (!api) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveNow().catch((e) => setStatus(String(e)));
    }, 800);
  }, [api, saveNow]);

  /** Save this board, then show another one. */
  const switchTo = useCallback(
    async (next: Promise<{ meta: BoardMeta; scene: string | null }>) => {
      try {
        await saveNow(true);
        const loaded = await next;
        resetPins();
        setApi(null);
        setBoard(toOpenBoard(loaded));
        setShowBoards(false);
        setStatus("");
      } catch (e) {
        setStatus(String(e));
      }
    },
    [saveNow, resetPins],
  );

  const newBoard = () => switchTo(invoke("vibe_board_new"));
  const openBoard = (id: string) => {
    if (id !== boardId.current) switchTo(invoke("vibe_board_open", { id }));
  };
  const deleteBoard = async (id: string) => {
    const wasOpen = id === boardId.current;
    if (wasOpen && saveTimer.current) clearTimeout(saveTimer.current);
    const next = await invoke<{ meta: BoardMeta; scene: string | null } | null>(
      "vibe_board_delete",
      { id },
    );
    if (next) {
      resetPins();
      setApi(null);
      setBoard(toOpenBoard(next));
    }
    setShowBoards(false);
  };

  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      handleChange(elements, appState);
      scheduleSave();
    },
    [handleChange, scheduleSave],
  );

  // Typing a note saves too.
  useEffect(scheduleSave, [notes, scheduleSave]);

  /** Place images below everything already on the board, left to right. */
  const addImages = useCallback(
    async (blobs: Blob[]) => {
      if (!api || blobs.length === 0) return;
      const scene = api.getSceneElements();
      const bottom = scene.reduce(
        (max, e) => Math.max(max, e.y + Math.abs(e.height)),
        0,
      );
      const left = scene.length ? Math.min(...scene.map((e) => e.x)) : 0;
      let x = left;
      const y = scene.length ? bottom + 60 : 0;
      const files: BinaryFileData[] = [];
      const skeletons: Skeleton = [];
      for (const blob of blobs) {
        const bitmap = await createImageBitmap(blob);
        const scale = Math.min(1, MAX_PLACED_WIDTH / bitmap.width);
        const id = `img-${Date.now().toString(36)}-${files.length}` as FileId;
        files.push({
          id,
          dataURL: (await blobToDataURL(blob)) as BinaryFileData["dataURL"],
          mimeType: (blob.type || "image/png") as BinaryFileData["mimeType"],
          created: Date.now(),
        });
        skeletons.push({
          type: "image",
          fileId: id,
          x,
          y,
          width: bitmap.width * scale,
          height: bitmap.height * scale,
        } as Skeleton[number]);
        x += bitmap.width * scale + 40;
      }
      api.addFiles(files);
      api.updateScene({
        elements: [...scene, ...convertToExcalidrawElements(skeletons)],
      });
      api.scrollToContent(undefined, { fitToContent: true });
    },
    [api],
  );

  const addPaths = useCallback(
    async (paths: string[]) => {
      const blobs: Blob[] = [];
      for (const path of paths) {
        try {
          const buf = await invoke<ArrayBuffer>("vibe_read_image", { path });
          blobs.push(new Blob([buf], { type: mimeFor(path) }));
        } catch (e) {
          setStatus(String(e));
        }
      }
      await addImages(blobs);
    },
    [addImages],
  );

  // Captures sent here with Alt+Enter (or "Add to board" in Captures).
  useEffect(() => {
    if (!api) return;
    const drain = () =>
      invoke<string[]>("vibe_board_take_inbox").then((paths) =>
        addPaths(paths),
      );
    drain();
    const unlisten = listen("vibe://board-inbox", drain);
    return () => {
      unlisten.then((f) => f());
    };
  }, [api, addPaths]);

  const pickFiles = async () => {
    const picked = await open({
      multiple: true,
      filters: [{ name: t("vibe.board.images"), extensions: IMAGE_EXTENSIONS }],
    });
    if (!picked) return;
    await addPaths(Array.isArray(picked) ? picked : [picked]);
  };

  const exportElements = useCallback(
    async (elements: readonly ExcalidrawElement[]) => {
      if (!api) throw new Error("Board not ready");
      const blob = await exportToBlob({
        elements,
        files: api.getFiles(),
        appState: {
          exportBackground: true,
          viewBackgroundColor: "#ffffff",
          exportWithDarkMode: false,
        },
        mimeType: "image/png",
        exportPadding: 8,
      });
      return new Uint8Array(await blob.arrayBuffer());
    },
    [api],
  );

  const sendBody = async (
    pngs: Uint8Array[],
    text: string,
    submit: boolean,
    copyOnly: boolean,
    hold = false,
  ) => {
    const meta = new TextEncoder().encode(
      JSON.stringify({
        imageSizes: pngs.map((p) => p.length),
        text,
        submit,
        copyOnly,
        hold,
      }),
    );
    const total = pngs.reduce((n, p) => n + p.length, 0);
    const body = new Uint8Array(4 + meta.length + total);
    new DataView(body.buffer).setUint32(0, meta.length, true);
    body.set(meta, 4);
    let at = 4 + meta.length;
    for (const png of pngs) {
      body.set(png, at);
      at += png.length;
    }
    await invoke("vibe_board_send", body);
  };

  const run = async (task: () => Promise<void>, done: string) => {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      await task();
      setStatus(done);
    } catch (e) {
      setStatus(String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Each image with whatever is drawn over it (pins included), in reading
   *  order. */
  const imagePngs = async () => {
    if (!api) return [];
    const elements = api.getSceneElements();
    const boxes = elements.map(toBox);
    const { imageIds } = compile(promptElements(elements).map(toBox));
    const pngs: Uint8Array[] = [];
    for (const id of imageIds) {
      const image = boxes.find((b) => b.id === id);
      if (!image) continue;
      const group = elements.filter((e, i) => {
        const box = boxes[i];
        return e.id === id || (box.kind !== "image" && intersects(box, image));
      });
      pngs.push(await exportElements(group));
    }
    return pngs;
  };

  const send = (submit: boolean) =>
    run(async () => {
      if (!api) return;
      const text = promptText(api.getSceneElements(), notes);
      await sendBody(await imagePngs(), text, submit, false);
    }, t("vibe.board.sent"));

  /** The whole board as one image plus the text on the clipboard, and Alt+V
   *  held to paste each image and then the text into any app. */
  const copy = () =>
    run(
      async () => {
        if (!api) return;
        const sheet = await exportElements(api.getSceneElements());
        const text = promptText(api.getSceneElements(), notes);
        await sendBody(
          [sheet, ...(await imagePngs())],
          text,
          false,
          true,
          true,
        );
      },
      t("vibe.board.copiedHold", { paste: showKey(keys.paste) }),
    );

  const copyText = () =>
    run(async () => {
      if (!api) return;
      await navigator.clipboard.writeText(
        promptText(api.getSceneElements(), notes),
      );
    }, t("vibe.board.copiedText"));

  const clear = () => {
    if (!api || !window.confirm(t("vibe.board.clearConfirm"))) return;
    api.resetScene();
    saveNow().catch((e) => setStatus(String(e)));
  };

  // Keys from Settings → Hotkeys, shared with the capture editor. The close
  // key only puts the Pin tool down: the board stays open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (matches(e, keys.pin)) {
        handled();
        armPin();
      } else if (
        (e.target as Element | null)?.closest?.(".excalidraw-wysiwyg")
      ) {
        return;
      } else if (matches(e, keys.numberShapes)) {
        handled();
        toggleNumberShapes();
      } else if (matches(e, keys.sendSubmit)) {
        handled();
        if (target) send(true);
      } else if (matches(e, keys.send)) {
        handled();
        if (target) send(false);
      } else if (matches(e, keys.copy)) {
        handled();
        copy();
      } else if (matches(e, keys.close) && pinMode) {
        handled();
        armPin(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!board) return status ? <p className="vibe-error">{status}</p> : null;

  return (
    <div className="vibe-board">
      <div className={`vibe-board-canvas${pinMode ? " pin-armed" : ""}`}>
        <Excalidraw
          key={board.meta.id}
          excalidrawAPI={setApi}
          initialData={{
            ...(board.initial as object),
            appState: {
              viewBackgroundColor: "#ffffff",
              currentItemFontFamily: FONT_FAMILY.Helvetica,
              currentItemRoughness: 0,
            },
            scrollToContent: true,
          }}
          onChange={onChange}
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              export: false,
              loadScene: false,
              saveAsImage: false,
              saveToActiveFile: false,
              toggleTheme: false,
            },
          }}
          renderTopRightUI={() => (
            <PinTools
              pinMode={pinMode}
              numberShapes={numberShapes}
              onPin={() => armPin()}
              onToggleNumbers={toggleNumberShapes}
              pinKey={keys.pin}
              numberKey={keys.numberShapes}
            />
          )}
        />
      </div>
      {notes.length > 0 && (
        <div className="vibe-panel vibe-board-notes">
          {notes.map((note, i) => (
            <PinNoteRow
              key={note.pinId}
              note={note}
              index={i}
              active={selectedPin === note.pinId}
              inputRef={(el) => {
                if (el) noteFields.current.set(note.pinId, el);
                else noteFields.current.delete(note.pinId);
              }}
              onFocus={() => {
                lastNote.current = note.pinId;
                selectPin(note.pinId);
              }}
              onText={(text) => setNote(note.pinId, text)}
              onRemove={() => removePin(note.pinId)}
            />
          ))}
        </div>
      )}
      {showBoards && (
        <BoardsPanel
          currentId={board.meta.id}
          onOpen={openBoard}
          onNew={newBoard}
          onDelete={deleteBoard}
          onRenamed={(id, name) =>
            setBoard((b) =>
              b && b.meta.id === id ? { ...b, meta: { ...b.meta, name } } : b,
            )
          }
          onClose={() => setShowBoards(false)}
        />
      )}
      <div className="vibe-board-bar">
        <button
          type="button"
          className={`vibe-btn${showBoards ? " on" : ""}`}
          title={t("vibe.boards.title")}
          onClick={() => {
            if (!showBoards) saveNow(true).catch(() => undefined);
            setShowBoards((v) => !v);
          }}
        >
          {BOARDS_ICON} {board.meta.name}
        </button>
        <button type="button" className="vibe-btn" onClick={newBoard}>
          {t("vibe.boards.new")}
        </button>
        <button type="button" className="vibe-btn" onClick={pickFiles}>
          {t("vibe.board.addFiles")}
        </button>
        <button type="button" className="vibe-btn" onClick={clear}>
          {t("vibe.board.clear")}
        </button>
        <span className="vibe-board-status">
          {status || t("vibe.board.hint")}
        </span>
        <button
          type="button"
          className="vibe-btn"
          disabled={busy}
          onClick={copyText}
        >
          {t("vibe.board.copyText")}
        </button>
        <button
          type="button"
          className="vibe-btn"
          disabled={busy}
          title={t("vibe.board.copyHint", { paste: showKey(keys.paste) })}
          onClick={copy}
        >
          {t("vibe.board.copy")}
          <kbd>{showKey(keys.copy)}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn primary"
          disabled={busy || !target}
          title={target ? undefined : t("vibe.board.noTarget")}
          onClick={() => send(false)}
        >
          {target
            ? t("vibe.board.sendTo", { app: target })
            : t("vibe.board.send")}
          <kbd>{showKey(keys.send)}</kbd>
        </button>
      </div>
    </div>
  );
}
