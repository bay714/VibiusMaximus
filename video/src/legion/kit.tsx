// Animated building blocks for the Legion video. The look (palette, fonts, shield, windows,
// keycaps, mock pages) comes from the storyboard's ui.tsx, so the video matches the
// storyboard frames exactly.
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { bouncy, pop, ramp } from "../anim";
import { DISPLAY, Keys, L, ShieldMark } from "../storyboard/ui";

export * from "../storyboard/ui";

export type SfxName =
  | "click"
  | "whoosh"
  | "shutter"
  | "pop"
  | "drop"
  | "chime"
  | "sparkle"
  | "drum"
  | "stamp"
  | "horn"
  | "scroll"
  | "shield"
  | "sword";

/** All sound effects sit this far under their nominal volume (they were too loud). */
const SFX_GAIN = 0.55;

/** A one-shot sound at frame `at` of the enclosing sequence (built by audio/legion.py). */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({
  at,
  name,
  volume = 0.5,
}) => (
  <Sequence
    from={Math.round(at)}
    durationInFrames={60}
    layout="none"
    name={`sfx ${name}`}
  >
    <Audio
      src={staticFile(`audio/legion/sfx/${name}.wav`)}
      volume={volume * SFX_GAIN}
    />
  </Sequence>
);

/** Fades a scene in from black and out to black. */
export const SceneFade: React.FC<{
  children: React.ReactNode;
  inFrames?: number;
  outFrames?: number;
}> = ({ children, inFrames = 10, outFrames = 10 }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o =
    ramp(f, 0, inFrames) *
    (1 - ramp(f, durationInFrames - outFrames, durationInFrames));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** Slow push-in so still shots breathe. */
export const Drift: React.FC<{
  children: React.ReactNode;
  from?: number;
  to?: number;
}> = ({ children, from = 1, to = 1.025 }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const s = from + (to - from) * (f / durationInFrames);
  return (
    <AbsoluteFill style={{ transform: `scale(${s})` }}>{children}</AbsoluteFill>
  );
};

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

/** Chapter label, top left. `titles` switch at the given frames (crossfade). */
export const Chip: React.FC<{
  n: number;
  titles: [number, string][];
  /** Replaces "ORDER n" for the unnumbered chapters (briefing, setup). */
  kicker?: string;
}> = ({ n, titles, kicker }) => {
  const f = useCurrentFrame();
  const enter = pop(f, 2);
  return (
    <div
      style={{
        position: "absolute",
        top: 58,
        left: 72,
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: enter,
        transform: `translateX(${(1 - enter) * -30}px)`,
        zIndex: 50,
      }}
    >
      <ShieldMark size={64} />
      <div>
        <div
          style={{
            fontFamily: DISPLAY,
            color: L.bronze2,
            fontSize: 19,
            letterSpacing: "0.32em",
          }}
        >
          {kicker ?? `ORDER ${ROMAN[n]}`}
        </div>
        <div style={{ position: "relative", height: 50, width: 700 }}>
          {titles.map(([at, title], i) => {
            const next = titles[i + 1]?.[0];
            const o =
              ramp(f, at, at + 10) *
              (next === undefined ? 1 : 1 - ramp(f, next, next + 10));
            if (o <= 0) return null;
            return (
              <div
                key={title}
                style={{
                  position: "absolute",
                  fontFamily: DISPLAY,
                  fontSize: 44,
                  lineHeight: 1.1,
                  opacity: o,
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export type Press = { combo: string; at: number; hold?: number };

/**
 * Keycast, top right: each combo springs in a few frames before `at`, lights while held,
 * and leaves after release (or when the next combo arrives).
 */
export const KeyCast: React.FC<{ presses: Press[]; sfx?: boolean }> = ({
  presses,
  sfx = true,
}) => {
  const f = useCurrentFrame();
  return (
    <>
      {presses.map((p, i) => {
        const hold = p.hold ?? 8;
        const next = presses[i + 1]?.at ?? Infinity;
        const show = p.at - 8;
        const hide = Math.min(p.at + hold + 22, next - 8);
        const enter = pop(f, show, { damping: 18, stiffness: 180 });
        const exit = ramp(f, hide, hide + 8);
        const visible = f >= show && f <= hide + 8;
        return (
          <React.Fragment key={i}>
            {sfx && <Sfx at={p.at} name="click" volume={0.25} />}
            {visible && (
              <div
                style={{
                  position: "absolute",
                  top: 64,
                  right: 72,
                  opacity: enter * (1 - exit),
                  transform: `translateY(${(1 - enter) * -16}px)`,
                  zIndex: 50,
                }}
              >
                <Keys
                  combo={p.combo}
                  size={72}
                  lit={f >= p.at && f <= p.at + hold}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export type Cap = { from: number; to: number; text: string };

/** Caption text: `{Ctrl+K}` → keycaps, `*word*` → bronze. */
export const Rich: React.FC<{ text: string; keySize?: number }> = ({
  text,
  keySize = 40,
}) => (
  <>
    {text.split(/(\{[^}]+\}|\*[^*]+\*)/).map((part, i) => {
      if (part.startsWith("{"))
        return <Keys key={i} combo={part.slice(1, -1)} size={keySize} />;
      if (part.startsWith("*"))
        return (
          <span key={i} style={{ color: L.bronze2 }}>
            {part.slice(1, -1)}
          </span>
        );
      return <span key={i}>{part}</span>;
    })}
  </>
);

/** Bottom-centre Marcellus captions. Items in one scene should not overlap in time. */
export const Captions: React.FC<{ items: Cap[] }> = ({ items }) => {
  const f = useCurrentFrame();
  return (
    <>
      {items.map((c, i) => {
        if (f < c.from || f > c.to + 10) return null;
        const enter = pop(f, c.from, { damping: 200, stiffness: 140 });
        const exit = ramp(f, c.to, c.to + 10);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 58,
              textAlign: "center",
              fontFamily: DISPLAY,
              fontSize: 40,
              color: L.text,
              textShadow: "0 2px 18px #000, 0 0 40px #000",
              opacity: enter * (1 - exit),
              transform: `translateY(${(1 - enter) * 16}px)`,
              zIndex: 60,
            }}
          >
            <Rich text={c.text} />
          </div>
        );
      })}
    </>
  );
};

/** Mouse cursor with a bronze click ripple. `clicks` are frames. */
export const Cursor: React.FC<{
  x: number;
  y: number;
  clicks?: number[];
  kind?: "arrow" | "cross";
  opacity?: number;
}> = ({ x, y, clicks = [], kind = "arrow", opacity = 1 }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        pointerEvents: "none",
        zIndex: 70,
      }}
    >
      {clicks.map((c) => {
        const t = ramp(f, c, c + 14);
        if (f < c || t >= 1) return null;
        const r = 6 + 18 * t;
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: -r,
              top: -r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: "50%",
              border: `2px solid ${L.bronze2}`,
              opacity: 1 - t,
            }}
          />
        );
      })}
      {kind === "arrow" ? (
        <svg
          width="26"
          height="30"
          viewBox="0 0 22 26"
          style={{
            position: "absolute",
            left: -2,
            top: -1,
            filter: "drop-shadow(0 2px 3px #0008)",
          }}
        >
          <path
            d="M2 1 L2 20 L7 15.5 L10.5 23.5 L13.5 22.2 L10.1 14.4 L16.8 14.4 Z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg
          width="28"
          height="28"
          viewBox="0 0 26 26"
          style={{ position: "absolute", left: -14, top: -14 }}
        >
          <path d="M13 1 V25 M1 13 H25" stroke="#111" strokeWidth="4" />
          <path d="M13 1 V25 M1 13 H25" stroke="#fff" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
};

/** Springs a child in at `at` (scale + fade). */
export const PopIn: React.FC<{
  at: number;
  children: React.ReactNode;
  bounce?: boolean;
  from?: number;
  style?: React.CSSProperties;
}> = ({ at, children, bounce, from = 0.6, style }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = bounce ? bouncy(f, at) : pop(f, at);
  return (
    <div
      style={{
        opacity: Math.min(1, p * 1.5),
        transform: `scale(${from + (1 - from) * p})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Slides/fades a child in from an offset at `at`. */
export const SlideIn: React.FC<{
  at: number;
  dx?: number;
  dy?: number;
  children: React.ReactNode;
  out?: number;
  style?: React.CSSProperties;
}> = ({ at, dx = 0, dy = 40, children, out, style }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = pop(f, at);
  const o = out === undefined ? 1 : 1 - ramp(f, out, out + 10);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: p * o,
        transform: `translate(${(1 - p) * dx}px, ${(1 - p) * dy}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Characters of `text` revealed between frames a and b. */
export const reveal = (text: string, f: number, a: number, b: number) =>
  text.slice(0, Math.round(text.length * ramp(f, a, b, 0, 1, (t) => t)));
