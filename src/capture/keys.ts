// Keys inside the capture editor and the board. Each action has a default and
// can be changed in Settings → Hotkeys (stored with the capture options).
// Combos are written like "Ctrl+Shift+Enter" or "Alt+`": modifiers in a fixed
// order, then the key, named from the physical key so they work the same on
// every keyboard layout.

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type KeyAction =
  | "pin"
  | "numberShapes"
  | "cleanup"
  | "send"
  | "sendSubmit"
  | "copy"
  | "toBoard"
  | "close";

export const KEY_ACTIONS: KeyAction[] = [
  "pin",
  "numberShapes",
  "copy",
  "send",
  "sendSubmit",
  "toBoard",
  "cleanup",
  "close",
];

export const DEFAULT_KEYS: Record<KeyAction, string> = {
  pin: "Alt+`",
  numberShapes: "Alt+N",
  cleanup: "Alt+D",
  send: "Ctrl+Enter",
  sendSubmit: "Ctrl+Shift+Enter",
  copy: "Alt+C",
  toBoard: "Alt+Enter",
  close: "Esc",
};

/** Held for a few minutes after Alt+C, in any app. */
export const DEFAULT_PASTE_KEY = "Alt+V";

const NAMED: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Enter: "Enter",
  NumpadEnter: "Enter",
  Escape: "Esc",
  Space: "Space",
  Tab: "Tab",
  Backspace: "Backspace",
  Delete: "Delete",
  Insert: "Insert",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

/** The key's name from its physical position, or null for modifiers. */
export function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return NAMED[code] ?? null;
}

/** "Ctrl+Alt+Shift+Key" for a key press, or null for a bare modifier. */
export function comboFromEvent(e: KeyboardEvent): string | null {
  const key = keyName(e.code);
  if (!key) return null;
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Win");
  parts.push(key);
  return parts.join("+");
}

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac/.test(navigator.platform || navigator.userAgent);

const MAC_SYMBOLS: Record<string, string> = {
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Win: "⌘",
  Mod: "⌘",
};

/** A combo as people expect to read it: "Alt+C" on Windows, "⌥C" on a Mac.
 *  "Mod" is Ctrl on Windows and ⌘ on a Mac (for Excalidraw's own keys). */
export function showKey(combo: string, separator = "+"): string {
  const parts = combo.split("+");
  if (IS_MAC) return parts.map((p) => MAC_SYMBOLS[p] ?? p).join("");
  return parts.map((p) => (p === "Mod" ? "Ctrl" : p)).join(separator);
}

export const matches = (e: KeyboardEvent, combo: string) =>
  comboFromEvent(e) === combo;

/** Combos the global hotkey layer can register for Alt+V: at least one
 *  modifier, then a letter, digit or F-key. */
export const isGlobalCombo = (combo: string) =>
  /^(Ctrl\+)?(Alt\+)?(Shift\+)?(Win\+)?([A-Z0-9]|F\d{1,2})$/.test(combo) &&
  combo.includes("+");

interface StoredKeys {
  keys?: Partial<Record<KeyAction, string>>;
  pasteKey?: string;
}

/** The current in-app keys (defaults with the user's changes on top), plus
 *  the paste key for hints. */
export function useKeys(): Record<KeyAction | "paste", string> {
  const [keys, setKeys] = useState({
    ...DEFAULT_KEYS,
    paste: DEFAULT_PASTE_KEY,
  });
  useEffect(() => {
    invoke<StoredKeys>("vibe_capture_settings_get")
      .then((o) =>
        setKeys({
          ...DEFAULT_KEYS,
          ...(o.keys ?? {}),
          paste: o.pasteKey || DEFAULT_PASTE_KEY,
        }),
      )
      .catch(() => undefined);
  }, []);
  return keys;
}
