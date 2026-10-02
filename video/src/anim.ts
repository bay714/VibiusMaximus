import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 0→1 (or from→to) between frames a and b, clamped. */
export const ramp = (
  f: number,
  a: number,
  b: number,
  from = 0,
  to = 1,
  easing: (t: number) => number = easeOut,
) => interpolate(f, [a, b], [from, to], { ...clamp, easing });

type SpringConfig = { damping?: number; stiffness?: number; mass?: number };

/** Smooth, non-bouncy spring that starts at frame `at`. */
export const pop = (f: number, at: number, config: SpringConfig = { damping: 200 }) =>
  spring({ frame: f - at, fps: FPS, config });

/** Spring with a little overshoot, for pins and drops. */
export const bouncy = (f: number, at: number) =>
  spring({ frame: f - at, fps: FPS, config: { damping: 11, stiffness: 170, mass: 0.6 } });

/** Characters of `text` typed so far. */
export const typed = (text: string, f: number, at: number, charsPerFrame = 1.2) =>
  text.slice(0, Math.max(0, Math.floor((f - at) * charsPerFrame)));

/** Whole words of `text` revealed so far, one every `framesPerWord`. */
export const typedWords = (text: string, f: number, at: number, framesPerWord = 3) => {
  const words = text.split(" ");
  const n = Math.max(0, Math.min(words.length, Math.floor((f - at) / framesPerWord) + 1));
  return f < at ? "" : words.slice(0, n).join(" ");
};

export type Point = { x: number; y: number };
export type Keyframe = [frame: number, x: number, y: number];

/** Position along a list of keyframes, eased between each pair. */
export const along = (f: number, keys: Keyframe[]): Point => {
  if (f <= keys[0][0]) return { x: keys[0][1], y: keys[0][2] };
  for (let i = 1; i < keys.length; i++) {
    const [f1, x1, y1] = keys[i];
    const [f0, x0, y0] = keys[i - 1];
    if (f <= f1) {
      const t = f1 === f0 ? 1 : easeInOut((f - f0) / (f1 - f0));
      return { x: lerp(x0, x1, t), y: lerp(y0, y1, t) };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last[1], y: last[2] };
};
