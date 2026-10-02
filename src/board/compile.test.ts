import assert from "node:assert/strict";
import { compile, readingOrder, type Box } from "./compile";

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

console.log("compile tests passed");
