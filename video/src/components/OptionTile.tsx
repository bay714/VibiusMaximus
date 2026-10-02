import React from "react";
import { C, FONT } from "../theme";

export type OptionVariant = "A" | "B" | "C" | "D" | "E";

/** A box inside a tile, in percent of the tile. */
const R: React.FC<{ l: number; t: number; w: number; h: number; bg: string; r?: number; border?: string }> = ({
  l,
  t,
  w,
  h,
  bg,
  r = 3,
  border,
}) => (
  <i
    style={{
      position: "absolute",
      display: "block",
      left: `${l}%`,
      top: `${t}%`,
      width: `${w}%`,
      height: `${h}%`,
      background: bg,
      borderRadius: r,
      border,
      boxSizing: "border-box",
    }}
  />
);

const DESIGNS: Record<OptionVariant, { bg: string; parts: React.ReactNode }> = {
  A: {
    bg: "#fff",
    parts: (
      <>
        <R l={30} t={26} w={40} h={8} bg="#111827" />
        <R l={34} t={41} w={32} h={5} bg="#cbd5e1" />
        <R l={34} t={58} w={14} h={10} bg="#4f46e5" r={4} />
        <R l={51} t={58} w={14} h={10} bg="#fff" r={4} border="1.5px solid #94a3b8" />
      </>
    ),
  },
  B: {
    bg: "#fff",
    parts: (
      <>
        <R l={9} t={22} w={38} h={8} bg="#111827" />
        <R l={9} t={36} w={30} h={5} bg="#cbd5e1" />
        <R l={9} t={56} w={17} h={11} bg="#4f46e5" r={4} />
        <R l={56} t={12} w={36} h={76} bg="linear-gradient(160deg,#c7d2fe,#c4b5fd)" r={6} />
      </>
    ),
  },
  C: {
    bg: "#111827",
    parts: (
      <>
        <R l={9} t={22} w={42} h={8} bg="#f3f4f6" />
        <R l={9} t={36} w={32} h={5} bg="#4b5563" />
        <R l={9} t={56} w={17} h={11} bg="#a78bfa" r={4} />
        <R l={60} t={18} w={30} h={64} bg="#1f2937" r={6} border="1px solid #374151" />
      </>
    ),
  },
  D: {
    bg: "#fff",
    parts: (
      <>
        <R l={0} t={0} w={100} h={40} bg="linear-gradient(90deg,#fde68a,#fda4af)" r={0} />
        <R l={9} t={54} w={46} h={8} bg="#111827" />
        <R l={9} t={70} w={34} h={5} bg="#cbd5e1" />
        <R l={70} t={54} w={20} h={11} bg="#4f46e5" r={4} />
      </>
    ),
  },
  E: {
    bg: "#fff",
    parts: (
      <>
        <R l={9} t={26} w={64} h={10} bg="#111827" />
        <R l={9} t={44} w={44} h={5} bg="#e2e8f0" />
        <R l={9} t={62} w={14} h={10} bg="#111827" r={4} />
      </>
    ),
  },
};

/** Label badge, e.g. "3 · B" or "Image 1". */
export const Label: React.FC<{ text: string; size?: number }> = ({ text, size = 11 }) => (
  <span
    style={{
      display: "inline-block",
      background: "#111827",
      color: "#fff",
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 1,
      padding: `${size * 0.36}px ${size * 0.6}px`,
      borderRadius: size * 0.5,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </span>
);

/** One of the five generated design options (A–E) as a small landing-page sketch. */
export const OptionTile: React.FC<{
  variant: OptionVariant;
  w: number;
  h: number;
  label?: string;
  selected?: number;
}> = ({ variant, w, h, label, selected = 0 }) => {
  const d = DESIGNS[variant];
  return (
    <div
      style={{
        position: "relative",
        width: w,
        height: h,
        flex: "none",
        borderRadius: 8,
        overflow: "hidden",
        background: d.bg,
        border: "1px solid #ffffff22",
        outline: selected > 0 ? `${2.5 * selected}px solid ${C.accent}` : "none",
        outlineOffset: 2,
      }}
    >
      {d.parts}
      {label && (
        <div style={{ position: "absolute", left: 6, top: 6 }}>
          <Label text={label} />
        </div>
      )}
    </div>
  );
};
