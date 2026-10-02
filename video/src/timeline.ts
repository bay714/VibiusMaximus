/**
 * Scene lengths in frames at 30 fps. The voiceover start times in src/audio/voiceover.json
 * and the music sections in audio/build.py are laid out against these; keep them in sync.
 */
export const SCENES = {
  hook: 150, // 0–5 s
  dictate: 210, // 5–12 s
  capture: 540, // 12–30 s
  send: 300, // 30–40 s
  board: 360, // 40–52 s
  macros: 570, // 52–71 s
  outro: 330, // 71–82 s
} as const;

export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);
