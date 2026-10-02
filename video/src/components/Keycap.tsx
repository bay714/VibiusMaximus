import React from "react";
import { interpolateColors, useCurrentFrame } from "remotion";
import { pop, ramp } from "../anim";
import { C, FONT } from "../theme";
import { Sfx } from "./Sfx";

/** A single key. `press` 0→1 pushes it down and lights it violet. */
export const Keycap: React.FC<{ label: string; size?: number; press?: number }> = ({
  label,
  size = 64,
  press = 0,
}) => {
  const depth = Math.max(2, size * 0.08);
  const lift = depth * (1 - press);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        minWidth: size,
        height: size,
        padding: `0 ${size * 0.28}px`,
        borderRadius: size * 0.2,
        background: `linear-gradient(180deg, ${interpolateColors(press, [0, 1], ["#2a303c", "#352a57"])}, ${interpolateColors(press, [0, 1], ["#1f232c", "#261f3d"])})`,
        border: `1px solid ${interpolateColors(press, [0, 1], [C.line2, C.accent])}`,
        boxShadow: [
          `0 ${lift}px 0 #07080b`,
          `0 ${lift + 4}px ${size * 0.25}px #0009`,
          "inset 0 1px 0 #ffffff17",
          `0 0 ${size * 0.45 * press}px ${C.accent}${press > 0 ? "88" : "00"}`,
        ].join(", "),
        transform: `translateY(${depth - lift}px)`,
        color: C.text,
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: size * 0.4,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};

/** Small inline keycaps, e.g. inside UI rows: <Kbd keys="Ctrl+K" />. */
export const Kbd: React.FC<{ keys: string; size?: number }> = ({ keys, size = 20 }) => (
  <span style={{ display: "inline-flex", gap: size * 0.18, verticalAlign: "middle" }}>
    {keys.split("+").map((k) => (
      <Keycap key={k} label={k} size={size} />
    ))}
  </span>
);

export type ComboPos = "top" | "topRight" | "bottom" | { x: number; y: number };

/**
 * Keycast overlay: the combo springs in, each key is pressed in turn at `at`,
 * held for `hold` frames, released, then the overlay fades out.
 */
export const KeyCombo: React.FC<{
  keys: string[];
  at: number;
  hold?: number;
  pos?: ComboPos;
  size?: number;
}> = ({ keys, at, hold = 20, pos = "top", size = 76 }) => {
  const f = useCurrentFrame();
  const start = at - 8;
  const end = at + hold + 18;
  const clicks = keys.map((k, i) => <Sfx key={`click${i}`} at={at + i * 3} name="click" volume={0.32} />);
  if (f < start || f > end) return <>{clicks}</>;

  const enter = pop(f, start, { damping: 15, stiffness: 220, mass: 0.7 });
  const exit = ramp(f, at + hold + 6, end);
  const release = ramp(f, at + hold, at + hold + 4);

  const place: React.CSSProperties =
    pos === "top"
      ? { left: "50%", top: 34 }
      : pos === "bottom"
        ? { left: "50%", bottom: 150 }
        : pos === "topRight"
          ? { right: 60, top: 44 }
          : { left: pos.x, top: pos.y };
  const centred = pos === "top" || pos === "bottom";

  return (
    <>
      {clicks}
      <div
      style={{
        position: "absolute",
        ...place,
        transform: `${centred ? "translateX(-50%) " : ""}translateY(${(1 - enter) * -18 + exit * -10}px) scale(${0.9 + 0.1 * enter})`,
        opacity: Math.min(1, enter) * (1 - exit),
        display: "flex",
        alignItems: "center",
        gap: size * 0.2,
        padding: `${size * 0.22}px ${size * 0.28}px ${size * 0.3}px`,
        borderRadius: size * 0.32,
        background: "rgba(11,13,18,0.88)",
        border: `1px solid ${C.line}`,
        boxShadow: "0 24px 60px #000c",
        zIndex: 50,
      }}
    >
      {keys.map((k, i) => {
        const press = ramp(f, at + i * 3, at + i * 3 + 3) * (1 - release);
        return (
          <React.Fragment key={k + i}>
            {i > 0 && (
              <span style={{ color: C.muted, fontFamily: FONT, fontSize: size * 0.42, fontWeight: 300 }}>+</span>
            )}
            <Keycap label={k} size={size} press={press} />
          </React.Fragment>
        );
      })}
      </div>
    </>
  );
};
