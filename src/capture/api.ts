import { invoke } from "@tauri-apps/api/core";

export type SendMode = "send" | "copyOnly" | "board";

export interface Frame {
  width: number;
  height: number;
  pixels: ImageData;
}

/** The frozen screen, served by Rust as `[width][height][RGBA…]`. */
export async function loadFrame(): Promise<Frame> {
  const buf = await invoke<ArrayBuffer>("vibe_frame");
  const view = new DataView(buf);
  const width = view.getUint32(0, true);
  const height = view.getUint32(4, true);
  const data = new Uint8ClampedArray(buf, 8, width * height * 4);
  return { width, height, pixels: new ImageData(data, width, height) };
}

export const captureReady = () => invoke("vibe_capture_ready");
export const closeCapture = () => invoke("vibe_close");

/** Body layout: `[meta length u32 LE][meta JSON][PNG bytes]`. */
export async function sendCapture(
  png: Uint8Array,
  text: string,
  mode: SendMode,
  submit: boolean,
): Promise<void> {
  const meta = new TextEncoder().encode(JSON.stringify({ text, mode, submit }));
  const body = new Uint8Array(4 + meta.length + png.length);
  new DataView(body.buffer).setUint32(0, meta.length, true);
  body.set(meta, 4);
  body.set(png, 4 + meta.length);
  await invoke("vibe_send", body);
}

/** Caption plus numbered notes, the text pasted after the image. */
export function formatText(caption: string, notes: string[]): string {
  const lines = [caption.trim()];
  notes.forEach((note, i) => {
    if (note.trim()) lines.push(`${i + 1}. ${note.trim()}`);
  });
  return lines.filter(Boolean).join("\n");
}

/** AI cleanup through Handy's post-processing provider. */
export function cleanupText(
  caption: string,
  notes: string[],
): Promise<{ caption: string; notes: string[] }> {
  return invoke("vibe_cleanup", { input: { caption, notes } });
}
