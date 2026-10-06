/**
 * Scene lengths in frames at 30 fps for the Legion how-to (storyboard v3 plus briefing and setup, ~201 s).
 * The voiceover start times in audio/voiceover.json and the music sections in
 * audio/legion.py are laid out against these; keep them in sync.
 */
export const SCENES = {
  open: 195, //   0.0–  6.5 s  cold open
  briefing: 705, //   6.5– 30.0 s  what the app is for, and the open source it's built on
  setup: 360, //  30.0– 42.0 s  first launch: download Canary 180M Flash
  dictate: 540, //  42.0– 60.0 s  I · Give the order (click first; hold, or tap to toggle)
  capture: 1065, //  60.0– 95.5 s  II · Mark the target (click the destination, Alt+S, shapes, pin)
  send: 420, //  95.5–109.5 s  III · Dispatch (to the window clicked before Alt+S)
  carry: 345, // 109.5–121.0 s  IV · The courier
  board: 795, // 121.0–147.5 s  V · The campaign (Alt+B, Alt+S → Alt+Enter ×3, build, send, saved)
  macros: 1170, // 147.5–186.5 s  VI · Standing orders (Scope → Execute, Research → Summarize, Plan)
  hotkeys: 165, // 186.5–192.0 s  VII · Headquarters
  finale: 270, // 192.0–201.0 s
} as const;

export const TOTAL = Object.values(SCENES).reduce((a, b) => a + b, 0);
