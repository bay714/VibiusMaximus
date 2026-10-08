import assert from "node:assert/strict";
import { compile, readingOrder, withAttached, type Box } from "./compile";

const img = (id: string, x: number, y: number): Box => ({
  id,
  kind: "image",
  x,
  y,
  width: 100,
  height: 80,
});
const txt = (id: string, x: number, y: number, text: string): Box => ({
  id,
  kind: "text",
  x,
  y,
  width: 200,
  height: 20,
  text,
});

// A row of images reads left to right.
assert.deepEqual(
  readingOrder([img("c", 300, 0), img("a", 0, 5), img("b", 150, -5)]).map(
    (b) => b.id,
  ),
  ["a", "b", "c"],
);

// Rows read top to bottom.
assert.deepEqual(
  readingOrder([img("low", 0, 300), img("high", 200, 0)]).map((b) => b.id),
  ["high", "low"],
);

// Prompt text with image markers in reading order.
const out = compile([
  txt("prompt", 0, -100, "Pick the best option"),
  img("a", 0, 0),
  img("b", 150, 0),
  txt("note", 0, 120, "Prefer the second one"),
]);
assert.deepEqual(out.imageIds, ["a", "b"]);
assert.equal(
  out.text,
  "2 images attached, in the order marked below.\nPick the best option\n[Image 1]\n[Image 2]\nPrefer the second one",
);

// Text drawn on top of an image is an annotation, not prompt text.
const label = { ...txt("label", 10, 30, "this button"), width: 60 };
assert.equal(
  compile([img("a", 0, 0), label]).text,
  "1 image attached, in the order marked below.\n[Image 1]",
);

// No images means no header.
assert.equal(compile([txt("t", 0, 0, "Just text")]).text, "Just text");

// An image keeps whole pins and numbered shapes, even when only part of one
// overlaps it: a pin's number is text inside the pin, a badge is grouped with
// its shape.
const el = (id: string, type: string, extra: object = {}) => ({
  id,
  type,
  containerId: null as string | null,
  groupIds: [] as string[],
  ...extra,
});
const scene = [
  el("shot", "image"),
  el("pin", "ellipse", { groupIds: ["p1"] }),
  el("pinNumber", "text", { containerId: "pin", groupIds: ["p1"] }),
  el("box", "rectangle", { groupIds: ["n1"] }),
  el("badge", "ellipse", { groupIds: ["n1"] }),
  el("badgeNumber", "text", { containerId: "badge" }),
  el("other", "image", { groupIds: ["n1"] }),
  el("far", "text"),
];
const ids = (picked: string[]) =>
  withAttached(
    scene.filter((e) => picked.includes(e.id)),
    scene,
  ).map((e) => e.id);
assert.deepEqual(ids(["shot", "pin"]), ["shot", "pin", "pinNumber"]);
assert.deepEqual(ids(["shot", "pinNumber"]), ["shot", "pin", "pinNumber"]);
assert.deepEqual(ids(["shot", "box"]), ["shot", "box", "badge", "badgeNumber"]);
assert.deepEqual(ids(["shot"]), ["shot"]);

console.log("compile tests passed");
