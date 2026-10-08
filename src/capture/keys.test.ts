// Standalone assert check (no JS unit-test runner in this repo). Run with:
//   bun src/capture/keys.test.ts
import assert from "node:assert";
import {
  DEFAULT_KEYS,
  comboFromEvent,
  isGlobalCombo,
  keyName,
  showKey,
} from "./keys";

const press = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  }) as KeyboardEvent;

assert.equal(keyName("KeyC"), "C");
assert.equal(keyName("Digit4"), "4");
assert.equal(keyName("Backquote"), "`");
assert.equal(keyName("F12"), "F12");
assert.equal(keyName("ShiftLeft"), null);

// Every default key is something comboFromEvent can produce.
assert.equal(
  comboFromEvent(press("Backquote", { altKey: true })),
  DEFAULT_KEYS.pin,
);
assert.equal(
  comboFromEvent(press("KeyD", { altKey: true })),
  DEFAULT_KEYS.cleanup,
);
assert.equal(
  comboFromEvent(press("KeyN", { altKey: true })),
  DEFAULT_KEYS.numberShapes,
);
assert.equal(
  comboFromEvent(press("Enter", { ctrlKey: true, shiftKey: true })),
  DEFAULT_KEYS.sendSubmit,
);
assert.equal(comboFromEvent(press("Escape")), DEFAULT_KEYS.close);
assert.equal(comboFromEvent(press("AltLeft", { altKey: true })), null);

assert.ok(isGlobalCombo("Alt+V"));
assert.ok(isGlobalCombo("Ctrl+Shift+F9"));
assert.ok(!isGlobalCombo("V"));
assert.ok(!isGlobalCombo("Alt+`"));

// Hints read as typed elsewhere ("Mod" is Ctrl) and in Mac symbols on a Mac,
// where the macOS build runs these tests.
if (/Mac/.test(navigator.platform || navigator.userAgent)) {
  assert.equal(showKey("Alt+C"), "⌥C");
  assert.equal(showKey("Ctrl+Shift+Enter"), "⌃⇧Enter");
  assert.equal(showKey("Mod+Z"), "⌘Z");
} else {
  assert.equal(showKey("Alt+C"), "Alt+C");
  assert.equal(showKey("Ctrl+Enter", " + "), "Ctrl + Enter");
  assert.equal(showKey("Mod+Z"), "Ctrl+Z");
}

console.log("keys: all assertions passed");
