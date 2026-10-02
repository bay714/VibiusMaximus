import React from "react";
import { C, FONT } from "../theme";

/** "Vibius" in violet, "Maximus" in white, one word. */
export const Wordmark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 120, style }) => (
  <span
    style={{
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: "-0.035em",
      lineHeight: 1,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    <span style={{ color: C.accent }}>Vibius</span>
    <span style={{ color: "#ffffff" }}>Maximus</span>
  </span>
);
