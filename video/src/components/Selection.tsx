import React from "react";
import { C, FONT } from "../theme";

/**
 * Capture selection: everything outside it is dimmed by `dim` (0–1).
 * With w = h = 0 the whole screen is dimmed, so one element covers every state.
 */
export const Selection: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  dim: number;
  dashed?: boolean;
  outline?: number;
  label?: string;
}> = ({ x, y, w, h, dim, dashed = false, outline = 1, label }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        boxShadow: `0 0 0 6000px rgba(8,10,14,${0.66 * dim})`,
        outline: w > 0 ? `2px ${dashed ? "dashed" : "solid"} rgba(139,92,246,${outline})` : "none",
        borderRadius: 2,
      }}
    />
    {label && w > 20 && (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y - 22,
          padding: "4px 6px",
          borderRadius: 4,
          background: C.accent,
          color: "#fff",
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 11,
          lineHeight: 1,
          opacity: outline,
        }}
      >
        {label}
      </div>
    )}
  </>
);
