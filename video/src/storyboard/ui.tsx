import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";
// The app's own shield shapes, so the video's logo can't drift from the app's.
import { BOSS, MONOGRAM, SHIELD, SHIELD_LEFT, SPINE } from "../../../src/components/icons/shield";

/** Legion, dark mode (src/styles/theme.css + src/capture/capture.css). */
export const L = {
  bg: "#17120f",
  card: "#1b1512",
  card2: "#221a15",
  line: "#3a2c24",
  line2: "#4d3a2f",
  text: "#f1e6d6",
  muted: "#a8988a",
  red: "#9e2b25",
  red2: "#b3342c",
  bronze: "#c08a43",
  bronze2: "#d4a157",
  pin: "#c0392b",
};

export const SANS = '"Segoe UI", Inter, system-ui, sans-serif';
export const DISPLAY = '"Marcellus", "Times New Roman", serif';
/** Excalidraw's hand-drawn text, approximated with a Windows handwriting font. */
export const HAND = '"Segoe Print", "Comic Sans MS", cursive';
export const MONO = '"Cascadia Mono", "Cascadia Code", Consolas, monospace';

// Marcellus is bundled with the app (OFL); load the same file here.
const fontHandle = delayRender("Marcellus");
new FontFace("Marcellus", `url(${staticFile("fonts/Marcellus-latin.woff2")}) format("woff2")`)
  .load()
  .then((f) => {
    (document.fonts as unknown as Set<FontFace>).add(f);
    continueRender(fontHandle);
  })
  .catch(() => continueRender(fontHandle));

/** Warm near-black stage with a soft light from above and a bronze hairline frame. */
export const Backdrop: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 90% 70% at 50% 18%, #2b1e15 0%, ${L.bg} 55%, #0e0a08 100%)`,
      fontFamily: SANS,
      color: L.text,
      overflow: "hidden",
    }}
  >
    {children}
    <div
      style={{
        position: "absolute",
        inset: 28,
        border: `1px solid ${L.bronze}2e`,
        borderRadius: 4,
        pointerEvents: "none",
      }}
    />
  </AbsoluteFill>
);

export const ShieldMark: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 40, style }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={style}>
    <path d={SHIELD} fill={L.red} stroke={L.bronze} strokeWidth={4} strokeLinejoin="round" />
    <path d={SHIELD_LEFT} fill="#fff" opacity={0.08} />
    <path d={SPINE} stroke={L.bronze} strokeWidth={4} strokeLinecap="round" />
    <circle {...BOSS} fill={L.bronze} />
    <text x="50" y="55.5" textAnchor="middle" fontFamily={DISPLAY} fontSize={15} fill="#2a1710">
      {MONOGRAM}
    </text>
  </svg>
);

export const Wordmark: React.FC<{ size?: number; stacked?: boolean }> = ({ size = 40, stacked }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: size, letterSpacing: "0.16em", lineHeight: 1.15, color: L.text }}>
    {stacked ? (
      <>
        <div>VIBIVS</div>
        <div>MAXIMVS</div>
      </>
    ) : (
      "VIBIVS MAXIMVS"
    )}
  </div>
);

/** One key. `lit` = being pressed: bronze edge and glow. */
export const Keycap: React.FC<{ label: string; size?: number; lit?: boolean }> = ({ label, size = 64, lit }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      minWidth: size,
      height: size,
      padding: `0 ${size * 0.28}px`,
      borderRadius: size * 0.2,
      background: lit ? "linear-gradient(180deg, #4a321d, #34241a)" : "linear-gradient(180deg, #2c221c, #201914)",
      border: `1px solid ${lit ? L.bronze2 : L.line2}`,
      boxShadow: [
        `0 ${lit ? 2 : Math.max(3, size * 0.08)}px 0 #0b0806`,
        `0 ${size * 0.12}px ${size * 0.3}px #0009`,
        "inset 0 1px 0 #ffffff14",
        lit ? `0 0 ${size * 0.5}px ${L.bronze}88` : "",
      ]
        .filter(Boolean)
        .join(", "),
      transform: lit ? `translateY(${size * 0.05}px)` : undefined,
      color: lit ? "#fff3df" : L.text,
      fontFamily: SANS,
      fontWeight: 600,
      fontSize: size * 0.4,
      lineHeight: 1,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
);

export const Keys: React.FC<{ combo: string; size?: number; lit?: boolean }> = ({ combo, size = 22, lit }) => (
  <span style={{ display: "inline-flex", gap: size * 0.18, verticalAlign: "middle" }}>
    {combo.split("+").map((k, i) => (
      <Keycap key={i} label={k} size={size} lit={lit} />
    ))}
  </span>
);

/** The big keycast in the top-right corner. */
export const KeyCast: React.FC<{ combos: string[] }> = ({ combos }) => (
  <div style={{ position: "absolute", top: 64, right: 72, display: "flex", alignItems: "center", gap: 22 }}>
    {combos.map((c, i) => (
      <React.Fragment key={c}>
        {i > 0 && <span style={{ color: L.bronze, fontSize: 34 }}>→</span>}
        <Keys combo={c} size={72} lit={i === combos.length - 1} />
      </React.Fragment>
    ))}
  </div>
);

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

/** Chapter label, top left: shield, "ORDER II", title. */
export const OrderChip: React.FC<{ n: number; title: string }> = ({ n, title }) => (
  <div style={{ position: "absolute", top: 58, left: 72, display: "flex", alignItems: "center", gap: 18 }}>
    <ShieldMark size={64} />
    <div>
      <div style={{ fontFamily: DISPLAY, color: L.bronze2, fontSize: 19, letterSpacing: "0.32em" }}>
        ORDER {ROMAN[n]}
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 44, lineHeight: 1.1 }}>{title}</div>
    </div>
  </div>
);

/** Caption, bottom centre. `{Ctrl+K}` renders keycaps, `*word*` renders bronze. */
export const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 62,
      textAlign: "center",
      fontFamily: DISPLAY,
      fontSize: 38,
      color: L.text,
      textShadow: "0 2px 18px #000",
    }}
  >
    {text.split(/(\{[^}]+\}|\*[^*]+\*)/).map((part, i) => {
      if (part.startsWith("{")) return <Keys key={i} combo={part.slice(1, -1)} size={40} />;
      if (part.startsWith("*")) return <span key={i} style={{ color: L.bronze2 }}>{part.slice(1, -1)}</span>;
      return <span key={i}>{part}</span>;
    })}
  </div>
);

type Box = { x: number; y: number; w: number; h: number };

/**
 * A desktop window. `kind` picks the chrome: other apps are neutral grey, VibiusMaximus's
 * own windows are warm Legion brown.
 */
export const Win: React.FC<
  Box & { title: string; kind?: "app" | "vibe" | "terminal" | "light"; children?: React.ReactNode; style?: React.CSSProperties }
> = ({ x, y, w, h, title, kind = "app", children, style }) => {
  const chrome = { app: "#2a2a2c", vibe: L.card, terminal: "#1c1c1c", light: "#ecebe8" }[kind];
  const body = { app: "#202022", vibe: L.bg, terminal: "#0c0c0c", light: "#fbfaf8" }[kind];
  const fg = kind === "light" ? "#3a3a3a" : "#c9c9cc";
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 12,
        overflow: "hidden",
        background: body,
        border: `1px solid ${kind === "vibe" ? L.line : kind === "light" ? "#d6d3cc" : "#3b3b3e"}`,
        boxShadow: "0 30px 80px #000a, 0 2px 0 #ffffff08 inset",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          height: 42,
          flex: "none",
          background: chrome,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          color: fg,
          fontSize: 15,
          gap: 10,
        }}
      >
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden" }}>{title}</span>
        <span style={{ letterSpacing: 22, opacity: 0.7 }}>─ ▢ ✕</span>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
};

/** Lucide line icons used by the app's sidebar (copied from lucide-react's icon nodes). */
const ICON_PATHS: Record<string, string[]> = {
  general: [
    "M10 18v-7",
    "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z",
    "M14 18v-7",
    "M18 18v-7",
    "M3 22h18",
    "M6 18v-7",
  ],
  capture: ["M22 12h-4", "M6 12H2", "M12 6V2", "M12 22v-4", "CIRCLE"],
  macros: [
    "M19 17V5a2 2 0 0 0-2-2H4",
    "M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3",
  ],
  captures: [
    "m22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16",
    "M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2",
    "M10 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
  ],
  history: [
    "M5 22h14",
    "M5 2h14",
    "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22",
    "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2",
  ],
  models: ["M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2"],
  advanced: [
    "M14.5 17.5 3 6 3 3 6 3 17.5 14.5",
    "M13 19 19 13",
    "M16 16 20 20",
    "M19 21 21 19",
    "M14.5 6.5 18 3 21 3 21 6 17.5 9.5",
    "M5 14 9 18",
    "M7 17 4 20",
    "M3 19 5 21",
  ],
  postprocess: [
    "M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z",
    "M16 8 2 22",
    "M17.5 15H9",
  ],
  hotkeys: [
    "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    "M10 8h.01",
    "M12 12h.01",
    "M14 8h.01",
    "M16 12h.01",
    "M18 8h.01",
    "M6 8h.01",
    "M7 16h10",
    "M8 12h.01",
  ],
  about: [
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
    "M12 22V2",
  ],
};

export const Icon: React.FC<{ name: keyof typeof ICON_PATHS; size?: number; color?: string }> = ({
  name,
  size = 22,
  color = "currentColor",
}) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    {ICON_PATHS[name].map((d) => (d === "CIRCLE" ? <circle key={d} cx={12} cy={12} r={10} /> : <path key={d} d={d} />))}
  </svg>
);

/** The page header tile: a section icon on red. */
export const Tile: React.FC<{ name: keyof typeof ICON_PATHS; size?: number }> = ({ name, size = 48 }) => (
  <span
    style={{
      display: "inline-grid",
      placeItems: "center",
      width: size,
      height: size,
      borderRadius: size * 0.26,
      background: L.red,
      boxShadow: `inset 0 0 0 1px ${L.bronze}8c`,
      color: "#fff",
    }}
  >
    <Icon name={name} size={size * 0.55} />
  </span>
);

/** Excalidraw's tool island, top centre of the canvas. */
export const ExcaliBar: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div
    style={{
      display: "flex",
      gap: 4 * scale,
      padding: 5 * scale,
      background: "#fff",
      borderRadius: 10 * scale,
      boxShadow: "0 1px 6px #0003",
      fontSize: 17 * scale,
      color: "#1b1b1f",
    }}
  >
    {["🔒", "✋", "↖", "▭", "◇", "○", "→", "/", "✎", "A", "⌫"].map((g, i) => (
      <span
        key={i}
        style={{
          width: 30 * scale,
          height: 30 * scale,
          display: "grid",
          placeItems: "center",
          borderRadius: 7 * scale,
          background: g === "A" ? "#e0dfff" : undefined,
          fontFamily: g === "A" ? HAND : SANS,
          filter: g === "🔒" || g === "✋" ? "grayscale(1)" : undefined,
        }}
      >
        {g}
      </span>
    ))}
  </div>
);

/** Red numbered marker, as the editor draws pins and numbered shapes. */
export const Num: React.FC<{ n: number; size?: number; style?: React.CSSProperties }> = ({ n, size = 30, style }) => (
  <span
    style={{
      display: "inline-grid",
      placeItems: "center",
      width: size,
      height: size,
      borderRadius: "50%",
      background: L.pin,
      color: "#fff",
      fontFamily: SANS,
      fontWeight: 700,
      fontSize: size * 0.5,
      boxShadow: "0 2px 6px #0006",
      flex: "none",
      ...style,
    }}
  >
    {n}
  </span>
);

const ACCENTS = ["#3b6cf6", "#0f766e", "#9333ea", "#d97706", "#e11d48", "#2563eb"];

/**
 * A made-up product landing page (the thing being changed), drawn at 800×460 and scaled
 * to `w`. `marked` adds the capture's annotations: a numbered box round the button and pin 2
 * on the nav.
 */
export const Page: React.FC<{
  w: number;
  variant?: number;
  marked?: boolean;
  /** Draw a hand-written note with an arrow on the page, as Excalidraw's Text tool would. */
  note?: string;
  style?: React.CSSProperties;
}> = ({ w, variant = 0, marked, note, style }) => {
  const s = w / 800;
  const accent = ACCENTS[variant % ACCENTS.length];
  const layoutB = variant % 2 === 1;
  return (
    <div style={{ width: w, height: 460 * s, overflow: "hidden", position: "relative", flex: "none", ...style }}>
      <div style={{ width: 800, height: 460, transform: `scale(${s})`, transformOrigin: "0 0", background: "#fbfaf8", position: "relative", fontFamily: SANS }}>
        <div style={{ height: 58, borderBottom: "1px solid #e8e5df", display: "flex", alignItems: "center", padding: "0 40px", gap: 12 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: accent }} />
          <span style={{ fontWeight: 700, fontSize: 21, color: "#1d1d1f" }}>acme</span>
          <span style={{ flex: 1 }} />
          {[64, 72, 58, 66].map((bw, i) => (
            <span key={i} style={{ width: bw, height: 10, borderRadius: 5, background: "#c9c5bd", marginLeft: 26, marginTop: i === 2 ? 9 : 0 }} />
          ))}
        </div>
        <div style={{ position: "absolute", left: layoutB ? 440 : 56, top: 104, width: 320 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#1d1d1f", lineHeight: 1.08, letterSpacing: "-0.02em" }}>
            Ship your product faster
          </div>
          {[300, 260, 200].map((bw, i) => (
            <div key={i} style={{ width: bw, height: 10, borderRadius: 5, background: "#d9d5ce", marginTop: i ? 12 : 26 }} />
          ))}
          <div style={{ marginTop: 34, width: 150, height: 46, borderRadius: 10, background: accent, color: "#fff", fontWeight: 600, fontSize: 17, display: "grid", placeItems: "center" }}>
            Get started
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: layoutB ? 56 : 470,
            top: 96,
            width: 272,
            height: 300,
            borderRadius: 18,
            background: `linear-gradient(140deg, ${accent}, ${accent}55)`,
          }}
        />
        {marked && (
          <>
            <svg style={{ position: "absolute", inset: 0 }} width={800} height={460}>
              <rect x={42} y={290} width={180} height={74} rx={6} fill="none" stroke={L.pin} strokeWidth={4} />
            </svg>
            <Num n={1} size={34} style={{ position: "absolute", left: 24, top: 272 }} />
            {note && (
              // Excalidraw's Text tool: an arrow character, not an arrow shape, so it gets no number.
              <div style={{ position: "absolute", left: 150, top: 376, fontFamily: HAND, fontSize: 24, color: "#1e6fd9", whiteSpace: "nowrap" }}>
                ↖ {note}
              </div>
            )}
            <Num n={2} size={34} style={{ position: "absolute", left: 714, top: 80 }} />
          </>
        )}
      </div>
    </div>
  );
};
