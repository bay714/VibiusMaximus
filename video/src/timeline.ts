/** Scene lengths in frames at 30 fps. Keep video/voiceover.md in sync. */
export const SCENES = {
  hook: 150, // 0–5 s
  dictate: 210, // 5–12 s
  capture: 540, // 12–30 s
  send: 300, // 30–40 s
  board: 360, // 40–52 s
  macros: 240, // 52–60 s
  outro: 300, // 60–70 s
} as const;

export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);
