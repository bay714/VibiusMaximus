import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../anim";
import { Keycap } from "../components/Keycap";
import { Sfx } from "../components/Sfx";
import { Scene } from "../components/Stage";
import { Wordmark } from "../components/Wordmark";
import { C } from "../theme";
import { SCENES } from "../timeline";

const STATS_OUT = 182;
const MARK_AT = 195;

const StatCard: React.FC<{ at: number; value: React.ReactNode; label: string; accent: string; size?: number }> = ({
  at,
  value,
  label,
  accent,
  size = 96,
}) => {
  const f = useCurrentFrame();
  const s = pop(f, at, { damping: 16, stiffness: 120 });
  return (
    <div
      style={{
        width: 470,
        height: 290,
        boxSizing: "border-box",
        padding: "40px 40px",
        borderRadius: 24,
        background: `linear-gradient(160deg, ${C.panel2}, ${C.panel})`,
        border: `1px solid ${C.line}`,
        boxShadow: "0 30px 70px #000a",
        opacity: Math.min(1, s),
        transform: `translateY(${(1 - s) * 60}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: size, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: accent }}>{value}</div>
      <div style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.25, color: C.text }}>{label}</div>
    </div>
  );
};

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["Ctrl", "Space"], label: "Dictate" },
  { keys: ["Alt", "Shift", "S"], label: "Capture" },
  { keys: ["Alt", "Shift", "B"], label: "Board" },
  { keys: ["Alt", "1–4"], label: "Prompt macros" },
];

/** 60–70 s: lightweight stats, then wordmark + shortcut cheat sheet. */
export const S7Outro: React.FC = () => {
  const f = useCurrentFrame();
  const statsOut = ramp(f, STATS_OUT, STATS_OUT + 14);
  const title = pop(f, 2, { damping: 200 });
  const mark = pop(f, MARK_AT, { damping: 18, stiffness: 110 });
  const tag = pop(f, MARK_AT + 14, { damping: 200 });
  const mb = Math.round(ramp(f, 40, 70, 0, 18));

  return (
    <Scene
      dur={SCENES.outro}
      fadeOut={16}
      captions={[
        { from: 8, to: 178, text: "Lightweight: nothing runs until you need it." },
        { from: 208, to: 330, text: "Show it. Say it. Paste it." },
      ]}
    >
      {[14, 26, 38].map((at) => (
        <Sfx key={at} at={at} name="drop" volume={0.35} />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Sfx key={i} at={MARK_AT + 24 + i * 6} name="pop" volume={0.14} />
      ))}
      {statsOut < 1 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - statsOut, transform: `translateY(${statsOut * -30}px)` }}>
          <div
            style={{
              position: "absolute",
              top: 150,
              left: 0,
              right: 0,
              textAlign: "center",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              opacity: title,
            }}
          >
            Lightweight by design
          </div>
          <div style={{ position: "absolute", top: 330, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
            <StatCard at={14} value="0%" label="CPU when idle" accent={C.accent} />
            <StatCard at={26} size={72} value="On demand" label="Windows open only when you use them" accent={C.text} />
            <StatCard
              at={38}
              value={
                <>
                  {mb}
                  <span style={{ fontSize: 56 }}> MB</span>
                </>
              }
              label="installer"
              accent={C.pin}
            />
          </div>
        </div>
      )}

      {f >= MARK_AT && (
        <>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 190,
              textAlign: "center",
              opacity: Math.min(1, mark),
              transform: `scale(${0.9 + 0.1 * mark})`,
            }}
          >
            <Wordmark size={148} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 372,
              textAlign: "center",
              fontSize: 40,
              color: C.muted,
              opacity: tag,
            }}
          >
            Voice-first capture for AI vibe coding.
          </div>
          <div style={{ position: "absolute", top: 520, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 28 }}>
            {SHORTCUTS.map((s, i) => {
              const p = pop(f, MARK_AT + 24 + i * 6, { damping: 18, stiffness: 140 });
              return (
                <div
                  key={s.label}
                  style={{
                    width: 380,
                    padding: "34px 0 30px",
                    borderRadius: 22,
                    background: C.panel,
                    border: `1px solid ${C.line}`,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 26,
                    opacity: Math.min(1, p),
                    transform: `translateY(${(1 - p) * 40}px)`,
                  }}
                >
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {s.keys.map((k, j) => (
                      <React.Fragment key={k}>
                        {j > 0 && <span style={{ color: C.muted, fontSize: 26 }}>+</span>}
                        <Keycap label={k} size={62} />
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 600 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Scene>
  );
};
