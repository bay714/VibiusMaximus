import React from "react";
import { C, FONT } from "../theme";

/** Windows-style minimise / maximise / close glyphs. */
const WinControls: React.FC<{ color: string }> = ({ color }) => (
  <div style={{ display: "flex", height: "100%", marginLeft: "auto" }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ width: 44, display: "grid", placeItems: "center" }}>
        <svg width="10" height="10" viewBox="0 0 10 10" stroke={color} strokeWidth="1" fill="none">
          {i === 0 && <line x1="0" y1="5.5" x2="10" y2="5.5" />}
          {i === 1 && <rect x="0.5" y="0.5" width="9" height="9" />}
          {i === 2 && <path d="M0 0 L10 10 M10 0 L0 10" />}
        </svg>
      </div>
    ))}
  </div>
);

const BrowserBar: React.FC<{ url: string }> = ({ url }) => (
  <div
    style={{
      height: 36,
      display: "flex",
      alignItems: "center",
      gap: 14,
      paddingLeft: 14,
      background: "#f3f4f6",
      borderBottom: "1px solid #d6d9df",
      color: "#6b7280",
      fontSize: 13,
    }}
  >
    <span>←</span>
    <span>→</span>
    <span>↻</span>
    <div
      style={{
        width: 420,
        height: 24,
        borderRadius: 12,
        background: "#fff",
        border: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        fontSize: 12,
        gap: 6,
      }}
    >
      <span style={{ fontSize: 10 }}>ⓘ</span>
      {url}
    </div>
    <WinControls color="#6b7280" />
  </div>
);

const AppBar: React.FC<{ title: React.ReactNode; dark?: boolean }> = ({ title, dark }) => (
  <div
    style={{
      height: 34,
      display: "flex",
      alignItems: "center",
      paddingLeft: 14,
      background: dark ? "#0c0d10" : "#13161c",
      borderBottom: `1px solid ${C.line}`,
      color: C.muted,
      fontSize: 12.5,
    }}
  >
    {title}
    <WinControls color={C.muted} />
  </div>
);

/**
 * A desktop window. Positioned absolutely in its parent's design space.
 * `browser` has a light address bar; `app` and `terminal` are dark.
 */
export const Window: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  variant?: "browser" | "app" | "terminal";
  title?: React.ReactNode;
  url?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ x, y, w, h, variant = "app", title, url = "localhost:3000", style, children }) => {
  const bar = variant === "browser" ? 36 : 34;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${variant === "browser" ? "#3a3f4a" : C.line}`,
        background: variant === "terminal" ? "#0c0d10" : C.bg,
        boxShadow: "0 30px 80px #000c, 0 0 0 1px #00000040",
        fontFamily: FONT,
        color: C.text,
        ...style,
      }}
    >
      {variant === "browser" ? <BrowserBar url={url} /> : <AppBar title={title} dark={variant === "terminal"} />}
      <div style={{ position: "absolute", left: 0, right: 0, top: bar, bottom: 0 }}>{children}</div>
    </div>
  );
};
