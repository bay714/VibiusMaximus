import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../theme";

/** Animated level bars. `level` 0 = flat/idle, 1 = talking. Deterministic per frame. */
export const Waveform: React.FC<{
  bars?: number;
  color?: string;
  height?: number;
  level?: number;
  barWidth?: number;
  gap?: number;
}> = ({ bars = 12, color = C.pin, height = 22, level = 1, barWidth = 3, gap = 2 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap, height }}>
      {Array.from({ length: bars }, (_, i) => {
        const wobble = 0.5 + 0.5 * Math.sin(f * 0.55 + i * 1.9) * Math.cos(f * 0.21 + i * 0.7);
        const envelope = 0.4 + 0.6 * Math.abs(Math.sin(f * 0.09 + i * 0.37));
        const h = Math.max(barWidth, height * (0.16 + 0.84 * wobble * envelope * level));
        return (
          <i
            key={i}
            style={{
              display: "block",
              width: barWidth,
              height: h,
              borderRadius: barWidth,
              background: color,
              opacity: 0.45 + 0.55 * level,
            }}
          />
        );
      })}
    </div>
  );
};
