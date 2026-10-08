/** A simplified board element: just what reading order needs. */
export interface Box {
  id: string;
  kind: "image" | "text" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const contains = (outer: Box, point: { x: number; y: number }) =>
  point.x >= outer.x &&
  point.x <= outer.x + outer.width &&
  point.y >= outer.y &&
  point.y <= outer.y + outer.height;

export const intersects = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/**
 * Top to bottom, then left to right. Items whose vertical centre falls within a
 * row's extent join that row, so a row of images side by side reads left to right.
 */
export function readingOrder<T extends Box>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { top: number; bottom: number; items: T[] }[] = [];
  for (const item of sorted) {
    const cy = centre(item).y;
    const row = rows.find((r) => cy >= r.top && cy <= r.bottom);
    if (row) {
      row.items.push(item);
      row.bottom = Math.max(row.bottom, item.y + item.height);
    } else {
      rows.push({ top: item.y, bottom: item.y + item.height, items: [item] });
    }
  }
  rows.sort((a, b) => a.top - b.top);
  return rows.flatMap((r) => r.items.sort((a, b) => a.x - b.x));
}

export interface Compiled {
  /** Image ids in paste order. */
  imageIds: string[];
  /** Prompt text with [Image n] markers where each image sits. */
  text: string;
}

/**
 * Turn the board into images plus one prompt. Text placed on top of an image
 * is an annotation (it's drawn into that image), not part of the prompt.
 */
export function compile(boxes: Box[]): Compiled {
  const images = boxes.filter((b) => b.kind === "image");
  const texts = boxes.filter(
    (b) =>
      b.kind === "text" &&
      b.text?.trim() &&
      !images.some((img) => contains(img, centre(b))),
  );
  const imageIds: string[] = [];
  const lines: string[] = [];
  for (const item of readingOrder([...images, ...texts])) {
    if (item.kind === "image") {
      imageIds.push(item.id);
      lines.push(`[Image ${imageIds.length}]`);
    } else {
      lines.push((item.text ?? "").trim());
    }
  }
  const n = imageIds.length;
  const header = n
    ? `${n} image${n > 1 ? "s" : ""} attached, in the order marked below.`
    : "";
  return { imageIds, text: [header, ...lines].filter(Boolean).join("\n") };
}

/** What `withAttached` needs to know about an element. */
export interface Attachable {
  id: string;
  type: string;
  containerId?: string | null;
  groupIds: readonly string[];
}

/**
 * `picked` plus everything that belongs with them, so an image never gets half
 * of something: the text inside a picked shape (a pin's number) and the rest
 * of any group a picked element is in (a shape's number badge). Other images
 * are never pulled in.
 */
export function withAttached<T extends Attachable>(
  picked: readonly T[],
  all: readonly T[],
): T[] {
  const ids = new Set(picked.map((e) => e.id));
  for (let grew = true; grew; ) {
    grew = false;
    const groups = new Set(
      all.filter((e) => ids.has(e.id)).flatMap((e) => e.groupIds),
    );
    for (const e of all) {
      if (ids.has(e.id) || e.type === "image") continue;
      const contained = !!e.containerId && ids.has(e.containerId);
      const grouped = e.groupIds.some((g) => groups.has(g));
      const container = all.some(
        (t) => t.containerId === e.id && ids.has(t.id),
      );
      if (contained || grouped || container) {
        ids.add(e.id);
        grew = true;
      }
    }
  }
  return all.filter((e) => ids.has(e.id));
}
