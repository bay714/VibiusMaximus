import React from "react";
import { C, FONT } from "../theme";
import { PinBadge, Pin } from "./Pin";

/*
 * The fake "Acme — Ship faster" landing page from docs/mockups, as a 960×564 page
 * (the browser content area). All coordinates below are in that space.
 */

const abs = (s: React.CSSProperties): React.CSSProperties => ({ position: "absolute", margin: 0, ...s });

export const AcmePage: React.FC = () => (
  <div
    style={{
      position: "relative",
      width: 960,
      height: 564,
      background: "#fff",
      color: "#111827",
      fontFamily: FONT,
      overflow: "hidden",
    }}
  >
    <div style={abs({ left: 40, top: 16, fontWeight: 800, fontSize: 18 })}>
      acme<span style={{ color: "#2563eb" }}>.</span>
    </div>
    <div style={abs({ right: 40, top: 18, display: "flex", gap: 24, color: "#4b5563", fontSize: 14 })}>
      <span>Product</span>
      <span>Pricing</span>
      <span>Docs</span>
      <span>Sign in</span>
    </div>
    <div
      style={abs({
        left: 80,
        top: 88,
        width: 480,
        fontSize: 40,
        lineHeight: 1.1,
        fontWeight: 800,
        letterSpacing: "-0.02em",
      })}
    >
      Ship faster with Acme
    </div>
    <div style={abs({ left: 80, top: 186, width: 470, color: "#6b7280", fontSize: 16, lineHeight: 1.45 })}>
      The all-in-one platform for teams who want to build, test and deploy without the busywork.
    </div>
    <div
      style={abs({
        left: 80,
        top: 256,
        width: 300,
        height: 44,
        boxSizing: "border-box",
        border: "1px solid #d1d5db",
        borderRadius: 8,
        color: "#9ca3af",
        padding: "11px 14px",
        fontSize: 14,
      })}
    >
      you@company.com
    </div>
    <div
      style={abs({
        left: 392,
        top: 253,
        width: 140,
        height: 50,
        borderRadius: 8,
        background: "#374151",
        color: "#fff",
        fontWeight: 600,
        fontSize: 14,
        textAlign: "center",
        lineHeight: "50px",
      })}
    >
      Sign up
    </div>
    <div style={abs({ left: 80, top: 314, fontSize: 12, color: "#9ca3af" })}>
      No credit card required · Free for 14 days
    </div>
    <div
      style={abs({
        left: 600,
        top: 76,
        width: 300,
        height: 250,
        borderRadius: 16,
        background: "linear-gradient(135deg, #dbeafe, #ede9fe)",
      })}
    >
      {[140, 220, 180].map((w, i) => (
        <div key={i} style={abs({ left: 24, top: 28 + i * 26, width: w, height: 12, borderRadius: 6, background: "#c7d2fe" })} />
      ))}
      <div style={abs({ left: 24, top: 118, width: 252, height: 108, borderRadius: 10, background: "#ffffffaa" })} />
    </div>
    <div
      style={abs({
        left: 80,
        top: 380,
        display: "flex",
        gap: 40,
        color: "#cbd5e1",
        fontWeight: 800,
        fontSize: 20,
      })}
    >
      <span>NORTHWIND</span>
      <span>globex</span>
      <span>Initech</span>
      <span>UMBRELLA</span>
    </div>
  </div>
);

/* ---------- the capture used throughout the video ---------- */

/** Selection over the sign-up row, in page coordinates. */
export const SEL = { x: 68, y: 240, w: 482, h: 100 };
/** Box drawn around the input + button, in selection coordinates. */
export const BOX = { x: 4, y: 6, w: 470, h: 64 };
/** Pin centres, in selection coordinates. */
export const PINS = [
  { x: 4, y: 6 },
  { x: 452, y: 20 },
  { x: 258, y: 82 },
];
export const NOTES = [
  "Input and button heights don't match. Make both 44px.",
  "Use the primary violet for this button.",
  "Make this note smaller and left-align it.",
];
export const RAMBLE =
  "um so basically this whole row should like work better on phones and kinda look like the rest of our stuff";
export const CLEAN = "Make the sign-up row responsive: stack the input and button on mobile and match our design system.";

/** Pink hand-drawn-ish box (two slightly offset strokes, like Excalidraw). */
export const SketchBox: React.FC<{ x: number; y: number; w: number; h: number; opacity?: number }> = ({
  x,
  y,
  w,
  h,
  opacity = 1,
}) => (
  <svg
    style={{ position: "absolute", left: x - 4, top: y - 4, overflow: "visible", opacity }}
    width={Math.max(1, w + 8)}
    height={Math.max(1, h + 8)}
  >
    <rect x={4} y={4} width={Math.max(0, w)} height={Math.max(0, h)} rx={8} fill="none" stroke={C.pin} strokeWidth={2.4} />
    <rect
      x={4.8}
      y={3.4}
      width={Math.max(0, w - 1)}
      height={Math.max(0, h + 1)}
      rx={9}
      fill="none"
      stroke={C.pin}
      strokeWidth={1}
      opacity={0.55}
    />
  </svg>
);

/**
 * The annotated capture as it is pasted: the cropped sign-up row with the box and
 * pins, plus (optionally) the caption band underneath. Rendered in selection
 * coordinates and scaled by `scale`.
 */
export const AcmeCrop: React.FC<{ scale: number; band?: boolean }> = ({ scale, band = true }) => {
  const bandH = band ? 78 : 0;
  return (
    <div
      style={{
        width: SEL.w * scale,
        height: (SEL.h + bandH) * scale,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${C.line}`,
        flex: "none",
      }}
    >
      <div style={{ width: SEL.w, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
        <div style={{ position: "relative", width: SEL.w, height: SEL.h, overflow: "hidden", background: "#fff" }}>
          <div style={{ position: "absolute", left: -SEL.x, top: -SEL.y }}>
            <AcmePage />
          </div>
          <SketchBox {...BOX} />
          {PINS.map((p, i) => (
            <Pin key={i} n={i + 1} x={p.x + (i === 0 ? 10 : 0)} y={p.y + (i === 0 ? 8 : 0)} size={20} />
          ))}
        </div>
        {band && (
          <div
            style={{
              height: bandH,
              boxSizing: "border-box",
              background: "#0f1115",
              padding: "8px 12px",
              fontFamily: FONT,
              fontSize: 11,
              lineHeight: 1.45,
              color: C.text,
            }}
          >
            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {CLEAN}
            </div>
            {NOTES.map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <PinBadge n={i + 1} size={12} />
                {n}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Thumbnail of the hero with two pins: "Current (Image 1)" on the board. */
export const AcmeThumb: React.FC<{ width: number; pins?: boolean }> = ({ width, pins = true }) => {
  const crop = { x: 50, y: 64, w: 580, h: 290 };
  const s = width / crop.w;
  return (
    <div
      style={{
        position: "relative",
        width,
        height: crop.h * s,
        overflow: "hidden",
        borderRadius: 8,
        background: "#fff",
        flex: "none",
      }}
    >
      <div style={{ position: "absolute", left: -crop.x * s, top: -crop.y * s, transform: `scale(${s})`, transformOrigin: "0 0" }}>
        <AcmePage />
      </div>
      {pins && (
        <>
          <Pin n={1} x={(530 - crop.x) * s} y={(110 - crop.y) * s} size={Math.max(14, 48 * s)} />
          <Pin n={2} x={(540 - crop.x) * s} y={(262 - crop.y) * s} size={Math.max(14, 48 * s)} />
        </>
      )}
    </div>
  );
};
