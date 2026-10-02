import React from "react";

/** Mouse cursor: Windows arrow or capture crosshair. `click` 0→1 plays a ripple. */
export const Cursor: React.FC<{
  x: number;
  y: number;
  kind?: "arrow" | "cross";
  click?: number;
  opacity?: number;
  /** Counter-scale when drawn inside a zoomed camera, so the cursor keeps its size. */
  scale?: number;
}> = ({ x, y, kind = "arrow", click = 0, opacity = 1, scale = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      pointerEvents: "none",
      zIndex: 40,
      transform: `scale(${scale})`,
      transformOrigin: "0 0",
    }}
  >
    {click > 0 && click < 1 && (
      <div
        style={{
          position: "absolute",
          left: -(6 + 16 * click),
          top: -(6 + 16 * click),
          width: 2 * (6 + 16 * click),
          height: 2 * (6 + 16 * click),
          borderRadius: "50%",
          border: "2px solid #a78bfa",
          opacity: 1 - click,
        }}
      />
    )}
    {kind === "arrow" ? (
      <svg width="22" height="26" viewBox="0 0 22 26" style={{ position: "absolute", left: -2, top: -1 }}>
        <path
          d="M2 1 L2 20 L7 15.5 L10.5 23.5 L13.5 22.2 L10.1 14.4 L16.8 14.4 Z"
          fill="#fff"
          stroke="#111"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ position: "absolute", left: -13, top: -13 }}>
        <path d="M13 1 V25 M1 13 H25" stroke="#111" strokeWidth="4" />
        <path d="M13 1 V25 M1 13 H25" stroke="#fff" strokeWidth="2" />
      </svg>
    )}
  </div>
);
