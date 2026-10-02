import React from "react";
import { useCurrentFrame } from "remotion";
import { bouncy } from "../anim";
import { C, FONT } from "../theme";

/** Numbered pink pin, centred on (x, y). Drops in with a bounce at `at`. */
export const Pin: React.FC<{ n: number; x: number; y: number; at?: number; size?: number }> = ({
  n,
  x,
  y,
  at,
  size = 24,
}) => {
  const f = useCurrentFrame();
  const s = at === undefined ? 1 : bouncy(f, at);
  if (s <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.pin,
        color: "#fff",
        border: `${Math.max(1.5, size * 0.09)}px solid #fff`,
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size * 0.5,
        lineHeight: 1,
        boxShadow: "0 2px 8px #0006",
        transform: `scale(${s})`,
      }}
    >
      {n}
    </div>
  );
};

/** Small inline pin badge for note rows and text. */
export const PinBadge: React.FC<{ n: number; size?: number }> = ({ n, size = 20 }) => (
  <span
    style={{
      flex: "none",
      display: "inline-grid",
      placeItems: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      background: C.pin,
      color: "#fff",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: size * 0.55,
      lineHeight: 1,
    }}
  >
    {n}
  </span>
);
