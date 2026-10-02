import React from "react";
import { useCurrentFrame } from "remotion";
import { pop } from "../anim";
import { C, FONT } from "../theme";

/** Success toast that slides in from the right at `at`. Position is its top-right corner. */
export const Toast: React.FC<{ text: string; at: number; right: number; top: number }> = ({
  text,
  at,
  right,
  top,
}) => {
  const f = useCurrentFrame();
  const p = pop(f, at, { damping: 18, stiffness: 160 });
  if (p <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        right,
        top,
        transform: `translateX(${(1 - p) * 40}px)`,
        opacity: Math.min(1, p),
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderRadius: 10,
        background: C.panel,
        border: `1px solid ${C.line}`,
        boxShadow: "0 12px 30px #000a",
        color: C.text,
        fontFamily: FONT,
        fontSize: 14,
        whiteSpace: "nowrap",
        zIndex: 30,
      }}
    >
      <span style={{ color: C.ok, fontWeight: 700 }}>✓</span>
      {text}
    </div>
  );
};
