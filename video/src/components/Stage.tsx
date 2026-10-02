import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { lerp, ramp } from "../anim";
import { C, FONT, H, W } from "../theme";
import { Captions, type Cap } from "./Caption";

/** Dark desktop behind every scene: soft violet/pink glows and a faint dot grid. */
export const Desktop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: [
        "radial-gradient(1100px 700px at 12% -5%, #8b5cf624, transparent 60%)",
        "radial-gradient(900px 600px at 105% 105%, #ff3b7f14, transparent 60%)",
        "radial-gradient(#ffffff0c 1px, transparent 1.4px) 0 0 / 28px 28px",
        C.bg,
      ].join(", "),
    }}
  />
);

/** Scene wrapper: desktop, content that dips in/out of the background, captions on top. */
export const Scene: React.FC<{
  dur: number;
  captions?: Cap[];
  fadeIn?: number;
  fadeOut?: number;
  children: React.ReactNode;
}> = ({ dur, captions = [], fadeIn = 10, fadeOut = 10, children }) => {
  const f = useCurrentFrame();
  const o = Math.min(fadeIn ? ramp(f, 0, fadeIn) : 1, fadeOut ? 1 - ramp(f, dur - fadeOut, dur) : 1);
  return (
    <AbsoluteFill style={{ fontFamily: FONT, color: C.text, overflow: "hidden" }}>
      <Desktop />
      <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: o }}>
        <Captions items={captions} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Places design-space UI (e.g. a 960×600 mockup) on the 1080p frame at a scale. */
export const Place: React.FC<{
  x: number;
  y: number;
  scale: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ x, y, scale, style, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${scale})`,
      transformOrigin: "0 0",
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Camera: as `p` goes 0→1, zooms from 1 to `zoom` and moves the frame point `focus`
 * to the screen point `to`.
 */
export const Camera: React.FC<{
  p: number;
  zoom: number;
  focus: { x: number; y: number };
  to?: { x: number; y: number };
  children: React.ReactNode;
}> = ({ p, zoom, focus, to = { x: W / 2, y: H / 2 }, children }) => {
  const z = lerp(1, zoom, p);
  const fx = lerp(W / 2, focus.x, p);
  const fy = lerp(H / 2, focus.y, p);
  const tx = lerp(W / 2, to.x, p) - fx * z;
  const ty = lerp(H / 2, to.y, p) - fy * z;
  return (
    <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: "0 0" }}>
      {children}
    </AbsoluteFill>
  );
};
