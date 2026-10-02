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
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type {
  ExcalidrawElement,
  FileId,
} from "@excalidraw/excalidraw/element/types";
import "@excalidraw/excalidraw/index.css";
import { compile, intersects, type Box } from "./compile";

// Fonts are bundled under /public/excalidraw so Excalidraw never fetches them.
(window as unknown as { EXCALIDRAW_ASSET_PATH: string }).EXCALIDRAW_ASSET_PATH =
  "/excalidraw/";

type Skeleton = NonNullable<Parameters<typeof convertToExcalidrawElements>[0]>;
type InitialData = { elements?: unknown; files?: unknown; appState?: unknown };

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];
/** Imported images are laid out at most this wide on the board. */
const MAX_PLACED_WIDTH = 520;
const KEYS = { send: "Ctrl+Enter", copyImage: "Ctrl+Shift+C" } as const;

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

const mimeFor = (path: string) => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "png";
  return ext === "jpg" ? "image/jpeg" : `image/${ext}`;
};

export default function BoardApp() {
  const { t } = useTranslation();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initial, setInitial] = useState<InitialData | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    invoke<string | null>("vibe_board_load").then((json) => {
      try {
        setInitial(json ? (JSON.parse(json) as InitialData) : {});
      } catch {
        setInitial({});
      }
    });
    invoke<string | null>("vibe_board_target").then(setTarget);
  }, []);

  const onChange = useCallback(() => {
    if (!api) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const scene = serializeAsJSON(
        api.getSceneElements(),
        { viewBackgroundColor: "#ffffff" },
        api.getFiles(),
        "local",
      );
      invoke("vibe_board_save", { scene });
    }, 800);
  }, [api]);

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
  ) => {
    const meta = new TextEncoder().encode(
      JSON.stringify({
        imageSizes: pngs.map((p) => p.length),
        text,
        submit,
        copyOnly,
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

  /** Each image with whatever is drawn over it, plus the compiled prompt. */
  const send = (submit: boolean) =>
    run(async () => {
      if (!api) return;
      const elements = api.getSceneElements();
      const boxes = elements.map(toBox);
      const { imageIds, text } = compile(boxes);
      const pngs: Uint8Array[] = [];
      for (const id of imageIds) {
        const image = boxes.find((b) => b.id === id);
        if (!image) continue;
        const group = elements.filter((e, i) => {
          const box = boxes[i];
          return (
            e.id === id || (box.kind !== "image" && intersects(box, image))
          );
        });
        pngs.push(await exportElements(group));
      }
      await sendBody(pngs, text, submit, false);
    }, t("vibe.board.sent"));

  const copyImage = () =>
    run(async () => {
      if (!api) return;
      await sendBody(
        [await exportElements(api.getSceneElements())],
        "",
        false,
        true,
      );
    }, t("vibe.board.copiedImage"));

  const copyText = () =>
    run(async () => {
      if (!api) return;
      await navigator.clipboard.writeText(
        compile(api.getSceneElements().map(toBox)).text,
      );
    }, t("vibe.board.copiedText"));

  const clear = () => {
    if (!api || !window.confirm(t("vibe.board.clearConfirm"))) return;
    api.resetScene();
    invoke("vibe_board_save", {
      scene: serializeAsJSON([], {}, {}, "local"),
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        send(false);
      } else if (e.key.toLowerCase() === "c" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        copyImage();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  if (!initial) return null;

  return (
    <div className="vibe-board">
      <div className="vibe-board-canvas">
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={{
            ...(initial as object),
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
        />
      </div>
      <div className="vibe-board-bar">
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
          onClick={copyImage}
        >
          {t("vibe.board.copyImage")}
          <kbd>{KEYS.copyImage}</kbd>
        </button>
        <button
          type="button"
          className="vibe-btn primary"
          disabled={busy || !target}
          title={target ? undefined : t("vibe.board.noTarget")}
          onClick={() => send(false)}
        >
          {target
            ? t("vibe.board.sendTo", { app: target.replace(/\.exe$/i, "") })
            : t("vibe.board.send")}
          <kbd>{KEYS.send}</kbd>
        </button>
      </div>
    </div>
  );
}
