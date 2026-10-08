// Text helpers for dictation on the board.

/** `text` inserted into `value` at `at`, with a space before it when needed,
 *  and where the caret should go after it. */
export function insertWords(value: string, at: number, text: string) {
  const before = value.slice(0, at);
  const after = value.slice(at);
  const sep = before && !/\s$/.test(before) ? " " : "";
  const inserted = `${before}${sep}${text}`;
  return { value: inserted + after, caret: inserted.length };
}

/** Break `text` into lines of at most about `width` characters. */
export function wrap(text: string, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
