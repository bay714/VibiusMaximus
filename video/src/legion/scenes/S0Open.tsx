import React from "react";
import { useCurrentFrame } from "remotion";
import { bouncy, pop, ramp } from "../../anim";
import {
  BOSS,
  MONOGRAM,
  SHIELD,
  SHIELD_LEFT,
  SPINE,
} from "../../../../src/components/icons/shield";
import { Backdrop, DISPLAY, L, SceneFade, Sfx, Wordmark } from "../kit";

/** The shield drawing itself: rim, red field, spine, boss, monogram. */
export const DrawnShield: React.FC<{ size: number; at?: number }> = ({
  size,
  at = 0,
}) => {
  const f = useCurrentFrame() - at;
  const rim = ramp(f, 0, 34);
  const field = ramp(f, 26, 46);
  const spine = ramp(f, 40, 56);
  const boss = bouncy(f, 52);
  const mono = ramp(f, 64, 78);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ overflow: "visible" }}
    >
      <path d={SHIELD} fill={L.red} opacity={field} />
      <path d={SHIELD_LEFT} fill="#fff" opacity={0.08 * field} />
      <path
        d={SHIELD}
        fill="none"
        stroke={L.bronze}
        strokeWidth={4}
        strokeLinejoin="round"
        // once drawn, a plain stroke: the dash left a notch where the outline starts and ends
        {...(rim < 1
          ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - rim }
          : {})}
      />
      <path
        d={SPINE}
        stroke={L.bronze}
        strokeWidth={4}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - spine}
      />
      <circle cx={BOSS.cx} cy={BOSS.cy} r={BOSS.r * boss} fill={L.bronze} />
      <text
        x="50"
        y="55.5"
        textAnchor="middle"
        fontFamily={DISPLAY}
        fontSize={15}
        fill="#2a1710"
        textRendering="geometricPrecision"
        opacity={mono}
      >
        {MONOGRAM}
      </text>
    </svg>
  );
};

/** "VENI · VIDI · VIBED", each word stamping in at its frame. */
export const Tagline: React.FC<{
  at: [number, number, number];
  size: number;
}> = ({ at, size }) => {
  const f = useCurrentFrame();
  const words = ["VENI", "VIDI", "VIBED"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.32,
        fontFamily: DISPLAY,
        fontSize: size,
        color: L.bronze2,
        letterSpacing: "0.08em",
      }}
    >
      {words.map((w, i) => {
        const p = pop(f, at[i], { damping: 14, stiffness: 220 });
        return (
          <React.Fragment key={w}>
            {i > 0 && (
              <span
                style={{
                  opacity: ramp(f, at[i] - 4, at[i] + 4),
                  fontSize: size * 0.6,
                }}
              >
                ·
              </span>
            )}
            <span
              style={{
                opacity: Math.min(1, p * 2),
                transform: `scale(${1.5 - 0.5 * p})`,
                display: "inline-block",
                textShadow: `0 0 ${30 * (1 - p)}px ${L.bronze2}`,
              }}
            >
              {w}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export const S0Open: React.FC = () => {
  const f = useCurrentFrame();
  const glow = ramp(f, 30, 70);
  const word = ramp(f, 82, 110);
  const rule = ramp(f, 100, 124);
  const sub = ramp(f, 166, 180);
  return (
    <SceneFade inFrames={1}>
      <Backdrop>
        <Sfx at={4} name="drum" volume={0.7} />
        <Sfx at={60} name="shield" volume={0.45} />
        {[118, 133, 148].map((at) => (
          <Sfx key={at} at={at} name="stamp" volume={0.55} />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ filter: `drop-shadow(0 0 ${60 * glow}px ${L.red}88)` }}>
            <DrawnShield size={250} at={6} />
          </div>
          <div
            style={{
              marginTop: 26,
              opacity: word,
              letterSpacing: `${0.4 - 0.24 * word}em`,
            }}
          >
            <Wordmark size={58} />
          </div>
          <div
            style={{
              width: 520 * rule,
              height: 1,
              background: `${L.bronze}88`,
              margin: "34px 0 30px",
            }}
          />
          <Tagline at={[120, 135, 150]} size={92} />
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 30,
              color: L.muted,
              marginTop: 22,
              letterSpacing: "0.06em",
              opacity: sub,
            }}
          >
            Your legion awaits, Commander.
          </div>
        </div>
      </Backdrop>
    </SceneFade>
  );
};
