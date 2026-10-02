import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { captureReady, closeCapture, loadFrame } from "./api";
import type { Crop } from "./Editor";

// Excalidraw is a large chunk: load it only once a region is selected.
const Editor = React.lazy(() => import("./Editor"));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const normalize = (
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
});

export default function CaptureApp() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);

  useEffect(() => {
    loadFrame()
      .then(async (frame) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        canvas.width = frame.width;
        canvas.height = frame.height;
        ctx.putImageData(frame.pixels, 0, 0);
        setReady(true);
        await captureReady();
      })
      .catch((e) => {
        console.error("Failed to load capture frame", e);
        closeCapture();
      });
  }, []);

  const cropTo = useCallback((r: Rect) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // CSS pixels → physical pixels of the frame.
    const sx = canvas.width / window.innerWidth;
    const sy = canvas.height / window.innerHeight;
    const width = Math.max(1, Math.round(r.w * sx));
    const height = Math.max(1, Math.round(r.h * sy));
    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    out
      .getContext("2d")
      ?.drawImage(
        canvas,
        Math.round(r.x * sx),
        Math.round(r.y * sy),
        width,
        height,
        0,
        0,
        width,
        height,
      );
    setCrop({ dataURL: out.toDataURL("image/png"), width, height, scale: sx });
  }, []);

  useEffect(() => {
    if (crop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCapture();
      if (e.key === "a" && e.ctrlKey) {
        e.preventDefault();
        cropTo({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [crop, cropTo]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (crop || e.button !== 0) return;
    setStart({ x: e.clientX, y: e.clientY });
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (start) setRect(normalize(start, { x: e.clientX, y: e.clientY }));
  };
  const onMouseUp = () => {
    if (!start) return;
    setStart(null);
    if (rect && rect.w > 4 && rect.h > 4) cropTo(rect);
    else setRect(null);
  };

  return (
    <div
      className="vibe-capture"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <canvas ref={canvasRef} className="vibe-frame" />
      {!rect && <div className="vibe-dim" />}
      {rect && (
        <div
          className="vibe-selection"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
        >
          {!crop && (
            <span className="vibe-size">
              {Math.round(rect.w * window.devicePixelRatio)} ×{" "}
              {Math.round(rect.h * window.devicePixelRatio)}
            </span>
          )}
        </div>
      )}
      {ready && !rect && (
        <div className="vibe-hint">{t("vibe.capture.selectHint")}</div>
      )}
      {crop && (
        <Suspense fallback={null}>
          <Editor crop={crop} />
        </Suspense>
      )}
    </div>
  );
}
