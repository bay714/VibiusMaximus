import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, pop, ramp } from "../anim";
import { Sfx } from "../components/Sfx";
import { Scene } from "../components/Stage";
import { Wordmark } from "../components/Wordmark";
import { C } from "../theme";
import { SCENES } from "../timeline";

const PHRASES = ["Show it.", "Say it.", "Paste it."];

/** 0–5 s: "Show it. Say it. Paste it." → wordmark → subtitle. */
export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const settle = pop(f, 62, { damping: 200, stiffness: 90 });
  const mark = pop(f, 70, { damping: 18, stiffness: 120 });
  const sub = pop(f, 92, { damping: 200 });
  const rule = ramp(f, 82, 112);

  return (
    <Scene dur={SCENES.hook} fadeIn={6}>
      {PHRASES.map((p, i) => (
        <Sfx key={p} at={6 + i * 15} name="pop" volume={0.18} />
      ))}
      <Sfx at={64} name="whoosh" volume={0.3} />
      <Sfx at={72} name="sparkle" volume={0.18} />
      <AbsoluteFill
        style={{ background: "radial-gradient(800px 420px at 50% 52%, #8b5cf622, transparent 70%)", opacity: mark }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: lerp(470, 292, settle),
          display: "flex",
          justifyContent: "center",
          gap: lerp(40, 22, settle),
          fontSize: lerp(104, 50, settle),
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: C.text,
        }}
      >
        {PHRASES.map((p, i) => {
          const s = pop(f, 6 + i * 15, { damping: 18, stiffness: 140 });
          return (
            <span
              key={p}
              style={{
                opacity: Math.min(1, s) * lerp(1, 0.75, settle),
                transform: `translateY(${(1 - s) * 40}px)`,
                filter: `blur(${(1 - Math.min(1, s)) * 8}px)`,
              }}
            >
              {p.slice(0, -1)}
              <span style={{ color: C.accent }}>.</span>
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 430,
          textAlign: "center",
          opacity: Math.min(1, mark),
          transform: `scale(${0.88 + 0.12 * mark})`,
        }}
      >
        <Wordmark size={164} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 622,
          width: 520 * rule,
          height: 4,
          borderRadius: 2,
          transform: "translateX(-50%)",
          background: `linear-gradient(90deg, transparent, ${C.accent}, ${C.pin}, transparent)`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 662,
          textAlign: "center",
          fontSize: 44,
          color: C.muted,
          opacity: sub,
          transform: `translateY(${(1 - sub) * 16}px)`,
        }}
      >
        Voice-first capture for AI vibe coding.
      </div>
    </Scene>
  );
};
