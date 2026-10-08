// Standalone assert check (no JS unit-test runner in this repo). Run with:
//   bun src/board/dictation.test.ts
import assert from "node:assert";
import { insertWords, wrap } from "./dictation";

// Appending to a note adds a space; an empty note gets none.
assert.deepEqual(insertWords("", 0, "make it red"), {
  value: "make it red",
  caret: 11,
});
assert.deepEqual(insertWords("Bigger", 6, "button"), {
  value: "Bigger button",
  caret: 13,
});
// No double space, and text after the caret is kept.
assert.deepEqual(insertWords("Swap  for a photo", 5, "this"), {
  value: "Swap this for a photo",
  caret: 9,
});

assert.equal(wrap("one two three", 60), "one two three");
assert.equal(wrap("aaa bbb ccc", 7), "aaa bbb\nccc");
assert.equal(wrap("averyveryverylongword", 5), "averyveryverylongword");

console.log("dictation: all assertions passed");
