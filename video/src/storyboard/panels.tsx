import React from "react";
import {
  Backdrop,
  Caption,
  DISPLAY,
  ExcaliBar,
  HAND,
  Icon,
  KeyCast,
  Keys,
  L,
  MONO,
  Num,
  OrderChip,
  Page,
  SANS,
  ShieldMark,
  Tile,
  Win,
  Wordmark,
} from "./ui";

// Everything here follows v1.0.3 (checked against the app by its build thread, 2026-10-05).
// Macros follow v1.0.4 (Research, Summarize, Plan, Scope, Execute on Alt+1-5). The video in
// src/legion/ is the current cut; this storyboard keeps the earlier two-macro layout.

const TAGLINE = "VENI · VIDI · VIBED";

// The capture used in chapters II–IV: rectangle ①, pin ②, and a Text-tool note (no number).
const CAPTION = "Make the landing page feel more premium";
const NOTE_1 = "Bigger button, in our bronze";
const NOTE_2 = "Swap this for a real product shot";
const SCRIBBLE = "more breathing room";
const CAPTURE_TEXT = ["[screenshot above]", CAPTION, `1. ${NOTE_1}`, `2. ${NOTE_2}`];
const CAPTURE_PATH = "C:\\Users\\you\\AppData\\Roaming\\com.bay714.vibiusmaximus\\captures\\capture-20261005-101530123.png";

/* ------------------------------------------------------------------ shared bits */

/** Chat composer text with an optional highlighted insert and a caret. */
const Composer: React.FC<{ text: string; insert?: string; h?: number }> = ({ text, insert, h = 96 }) => (
  <div
    style={{
      margin: "0 40px 30px",
      minHeight: h,
      borderRadius: 18,
      background: "#2b2b2e",
      border: "1px solid #3b3b3e",
      padding: "18px 22px",
      fontSize: 22,
      lineHeight: 1.45,
      color: "#ececec",
      whiteSpace: "pre-wrap",
    }}
  >
    {text}
    {insert && (
      <span style={{ background: `${L.bronze}38`, boxShadow: `0 0 0 2px ${L.bronze}38`, borderRadius: 4, color: "#fff3df" }}>
        {insert}
      </span>
    )}
    <span style={{ display: "inline-block", width: 2, height: 26, background: "#ececec", verticalAlign: "middle", marginLeft: 2 }} />
  </div>
);

const Bubble: React.FC<{ me?: boolean; children: React.ReactNode; w?: number; size?: number }> = ({ me, children, w = 560, size = 21 }) => (
  <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start", padding: "0 40px", marginTop: 22 }}>
    <div
      style={{
        maxWidth: w,
        background: me ? "#303033" : "transparent",
        borderRadius: 18,
        padding: me ? "14px 20px" : "4px 0",
        fontSize: size,
        lineHeight: 1.45,
        color: me ? "#ececec" : "#bdbdc2",
      }}
    >
      {children}
    </div>
  </div>
);

const Btn: React.FC<{ children: React.ReactNode; primary?: boolean; size?: number }> = ({ children, primary, size = 17 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: primary ? L.red2 : "#241b16",
      border: `1px solid ${primary ? L.red2 : L.line}`,
      color: primary ? "#fff" : L.text,
      borderRadius: 9,
      padding: `${size * 0.45}px ${size * 0.8}px`,
      fontSize: size,
      fontWeight: primary ? 600 : 400,
      whiteSpace: "nowrap",
      flex: "none",
    }}
  >
    {children}
  </span>
);

/** Top right of every canvas: "① Pin Alt+`", "# Number shapes Alt+N" (on by default), Excalidraw's Library. */
const PinTools: React.FC = () => (
  <div style={{ display: "flex", gap: 8 }}>
    {(
      [
        ["① Pin", "Alt+`", false],
        ["# Number shapes", "Alt+N", true],
        ["▤ Library", "", false],
      ] as const
    ).map(([label, key, on]) => (
      <span
        key={label}
        style={{
          background: on ? L.red : "#fff",
          color: on ? "#fff" : "#221814",
          border: `1px solid ${on ? L.red : "#dccdb6"}`,
          borderRadius: 9,
          padding: "8px 13px",
          fontSize: 16,
          fontWeight: 500,
          boxShadow: "0 1px 3px #0002",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {key && <span style={{ fontSize: 13, opacity: 0.75, marginLeft: 8 }}>{key}</span>}
      </span>
    ))}
  </div>
);

/** A numbered note row under a canvas. */
const NoteRow: React.FC<{ n: number; text: string; active?: boolean }> = ({ n, text, active }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 16px",
      borderTop: `1px solid ${n > 1 ? "#2b211b" : L.line}`,
      background: active ? `${L.pin}1a` : undefined,
    }}
  >
    <Num n={n} size={28} style={active ? { boxShadow: "0 0 0 2px #fff" } : undefined} />
    <span style={{ flex: 1, color: L.text }}>{text}</span>
    <span style={{ color: L.muted }}>×</span>
  </div>
);

/** The capture editor (v1.0.3 layout). */
const Editor: React.FC<{ w: number }> = ({ w }) => (
  <div
    style={{
      width: 980,
      transform: `scale(${w / 980})`,
      transformOrigin: "0 0",
      background: L.card,
      border: `1px solid ${L.line}`,
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 30px 90px #000c",
      fontSize: 18,
    }}
  >
    <div style={{ position: "relative" }}>
      <Page w={980} marked note={SCRIBBLE} />
      <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <ExcaliBar scale={0.9} />
      </div>
      <div style={{ position: "absolute", top: 62, right: 12 }}>
        <PinTools />
      </div>
    </div>
    {/* caption row, with Clean up at its right end */}
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", borderTop: `1px solid ${L.line}` }}>
      <span style={{ color: L.bronze2, width: 28, textAlign: "center" }}>✎</span>
      <span style={{ flex: 1, color: L.text }}>{CAPTION}</span>
      <Btn size={15}>
        ✨ Clean up <Keys combo="Alt+D" size={16} />
      </Btn>
    </div>
    <NoteRow n={1} text={NOTE_1} active />
    <NoteRow n={2} text={NOTE_2} />
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#150f0c", borderTop: `1px solid ${L.line}`, color: L.muted, fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        Alt+C copies · then Alt+V in any app pastes the image and the text
      </span>
      <Btn size={14}>
        Cancel <Keys combo="Esc" size={15} />
      </Btn>
      <Btn size={14}>
        Add to board <Keys combo="Alt+Enter" size={15} />
      </Btn>
      <Btn size={14}>
        Copy <Keys combo="Alt+C" size={15} />
      </Btn>
      <Btn size={14}>
        Send + submit <Keys combo="Ctrl+Shift+Enter" size={15} />
      </Btn>
      <Btn primary size={14}>
        Send to Chrome <Keys combo="Ctrl+Enter" size={15} />
      </Btn>
    </div>
  </div>
);

/** The sent image: the marked-up shot plus the caption strip printed along its bottom (on by default). */
const SentShot: React.FC<{ w: number; style?: React.CSSProperties }> = ({ w, style }) => (
  <div style={{ width: w, borderRadius: 10, overflow: "hidden", ...style }}>
    <Page w={w} marked note={SCRIBBLE} />
    <div style={{ background: "#1b1512", color: "#f1e6d6", fontFamily: SANS, fontSize: w * 0.026, lineHeight: 1.4, padding: `${w * 0.015}px ${w * 0.025}px` }}>
      <div style={{ fontWeight: 600 }}>{CAPTION}</div>
      <div style={{ opacity: 0.85 }}>
        ① {NOTE_1} · ② {NOTE_2}
      </div>
    </div>
  </div>
);

/** The v1.0.4 starter macros. On screen only each first line is shown (the texts are long). */
const MACROS = [
  ["Alt+1", "Research"],
  ["Alt+2", "Summarize"],
  ["Alt+3", "Plan"],
  ["Alt+4", "Scope"],
  ["Alt+5", "Execute"],
];
const MACRO_RESEARCH =
  "Research this before answering. Prefer primary sources (official docs, changelogs, specs, source code) …";
const MACRO_SUMMARY = "Summarize the above for someone who wasn't following along. …";

/** Settings → Macros (the settings window is just "Vibius Maximus"). */
const MacroCard: React.FC<{ lit: number }> = ({ lit }) => (
  <Win x={1250} y={240} w={570} h={500} title="Vibius Maximus" kind="vibe">
    <div style={{ padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <Tile name="macros" size={46} />
        <span style={{ fontFamily: DISPLAY, fontSize: 34 }}>Macros</span>
      </div>
      <div style={{ border: `1px solid ${L.line}`, borderRadius: 12, overflow: "hidden" }}>
        {MACROS.map(([key, name], i) => (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "18px 18px",
              borderTop: i ? `1px solid ${L.line}` : undefined,
              background: i === lit ? `${L.bronze2}22` : L.card,
              boxShadow: i === lit ? `inset 4px 0 0 ${L.bronze2}` : undefined,
              fontSize: 21,
            }}
          >
            <Keys combo={key} size={26} lit={i === lit} />
            <span style={{ color: i === lit ? L.bronze2 : L.text }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  </Win>
);

/* ------------------------------------------------------------------ panels */

const P0Title: React.FC = () => (
  <Backdrop>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <ShieldMark size={250} style={{ filter: `drop-shadow(0 0 60px ${L.red}66)` }} />
      <div style={{ marginTop: 26 }}>
        <Wordmark size={58} />
      </div>
      <div style={{ width: 520, height: 1, background: `${L.bronze}88`, margin: "34px 0 30px" }} />
      <div style={{ fontFamily: DISPLAY, fontSize: 92, color: L.bronze2, letterSpacing: "0.08em" }}>{TAGLINE}</div>
      <div style={{ fontFamily: DISPLAY, fontSize: 30, color: L.muted, marginTop: 22, letterSpacing: "0.06em" }}>
        Your legion awaits, Commander.
      </div>
    </div>
  </Backdrop>
);

const P1Dictate: React.FC = () => (
  <Backdrop>
    <OrderChip n={1} title="Give the order" />
    <KeyCast combos={["Ctrl+Space"]} />
    <Win x={330} y={180} w={1260} h={640} title="Chat — Google Chrome">
      <Bubble me>The settings page needs a dark mode.</Bubble>
      <Bubble>Sure — where should the toggle live, and should it follow the system setting by default?</Bubble>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Composer text="Put it under Appearance, follow the system by default, and remember the choice." />
      </div>
    </Win>
    {/* Handy's recording overlay, bottom of the screen */}
    <div
      style={{
        position: "absolute",
        left: 960 - 150,
        top: 856,
        width: 300,
        height: 62,
        borderRadius: 31,
        background: L.card,
        border: `1px solid ${L.bronze}aa`,
        boxShadow: `0 14px 40px #000c, 0 0 30px ${L.bronze}33`,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 26px",
      }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 7, background: L.red2, marginRight: 12, boxShadow: `0 0 10px ${L.red2}` }} />
      {[10, 22, 34, 18, 40, 28, 14, 30, 38, 20, 12, 26, 16].map((bh, i) => (
        <span key={i} style={{ width: 6, height: bh, borderRadius: 3, background: L.bronze2 }} />
      ))}
    </div>
    <Caption text="Hold {Ctrl+Space} and give the order. Offline, in *any app*." />
  </Backdrop>
);

const P2Capture: React.FC = () => (
  <Backdrop>
    {/* the frozen, dimmed screen behind the editor */}
    <div style={{ position: "absolute", inset: 0, opacity: 0.35, filter: "saturate(0.6)" }}>
      <Win x={120} y={150} w={1680} h={860} title="acme — Google Chrome" kind="light">
        <Page w={1680} />
      </Win>
    </div>
    <div style={{ position: "absolute", inset: 0, background: "rgba(18,12,9,0.55)" }} />
    <OrderChip n={2} title="Mark the target" />
    <KeyCast combos={["Alt+S"]} />
    <div style={{ position: "absolute", left: 960 - 490, top: 172 }}>
      <Editor w={980} />
    </div>
    <Caption text="{Alt+S} freezes the screen. Box it, *write on it*, pin it." />
  </Backdrop>
);

const P3Send: React.FC = () => (
  <Backdrop>
    <OrderChip n={3} title="Dispatch" />
    <KeyCast combos={["Ctrl+Enter"]} />
    <Win x={90} y={190} w={1030} h={730} title="Chat — Google Chrome">
      <Bubble me w={520} size={19}>
        <SentShot w={480} style={{ marginBottom: 12 }} />
        {CAPTURE_TEXT.map((l) => (
          <div key={l} style={{ color: l.startsWith("[") ? L.bronze2 : undefined }}>
            {l}
          </div>
        ))}
      </Bubble>
    </Win>
    <Win x={1160} y={250} w={680} h={600} title="Windows Terminal — claude" kind="terminal">
      <div style={{ fontFamily: MONO, fontSize: 17, lineHeight: 1.55, color: "#d4d4d4", padding: "18px 22px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        <span style={{ color: L.bronze2 }}>{"> "}</span>
        {`${CAPTURE_PATH}\n  ${CAPTION}\n  1. ${NOTE_1}\n  2. ${NOTE_2}\n\n`}
        <span style={{ color: "#9cdcfe" }}>●</span>
        {" Read(capture-20261005-101530123.png)\n"}
        <span style={{ color: "#9cdcfe" }}>●</span>
        {" Task(Restyle the CTA button)\n"}
        <span style={{ color: "#9cdcfe" }}>●</span>
        {" Task(Replace hero illustration)\n"}
        <span style={{ color: "#8a8a8a" }}>{"  ⎿ 2 subagents running…"}</span>
      </div>
    </Win>
    <Caption text="{Ctrl+Enter} dispatches it: image, then notes. *Terminals* get a file path." />
  </Backdrop>
);

const P4Carry: React.FC = () => (
  <Backdrop>
    <OrderChip n={4} title="The courier" />
    <KeyCast combos={["Alt+C", "Alt+V"]} />
    {/* Alt+C copies and closes the editor */}
    <div style={{ position: "absolute", left: 120, top: 200, opacity: 0.45, filter: "blur(1px)" }}>
      <Editor w={640} />
    </div>
    <svg style={{ position: "absolute", inset: 0 }} width={1920} height={1080}>
      <path d="M 820 330 C 900 230, 1000 230, 1070 300" fill="none" stroke={L.bronze} strokeWidth={4} strokeDasharray="4 14" strokeLinecap="round" />
      <path d="M 1052 282 L 1072 302 L 1046 308" fill="none" stroke={L.bronze} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <Win x={1090} y={190} w={730} h={520} title="New issue — Tracker" kind="light">
      <div style={{ padding: "16px 24px", color: "#2a2a2a", fontSize: 18, lineHeight: 1.45 }}>
        <div style={{ fontWeight: 700, fontSize: 24, marginBottom: 10 }}>Landing page polish</div>
        <SentShot w={330} style={{ border: "1px solid #ddd", marginBottom: 10 }} />
        {CAPTURE_TEXT.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </Win>
    {/* Captures page: reopen */}
    <Win x={100} y={740} w={1720} h={190} title="Vibius Maximus" kind="vibe">
      <div style={{ display: "flex", gap: 22, padding: "16px 22px", alignItems: "center" }}>
        <Tile name="captures" size={44} />
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <div key={v} style={{ position: "relative", borderRadius: 8, outline: v === 1 ? `3px solid ${L.bronze2}` : `1px solid ${L.line}`, overflow: "hidden" }}>
            <Page w={190} variant={v} marked={v === 1} />
          </div>
        ))}
        <span style={{ fontFamily: DISPLAY, color: L.bronze2, fontSize: 22, lineHeight: 1.2 }}>
          Double-click
          <br />
          to reopen
        </span>
      </div>
    </Win>
    <Caption text="{Alt+C} copies it all. {Alt+V} delivers it to *any* app." />
  </Backdrop>
);

// The board example: pin ①, circle ②, box ③ (Number shapes on), "too busy" written on image 1
// (drawn into it), and prompt text above and below the row.
const BOARD_INTRO = "Redesign the pricing page to match our new brand.";
const BOARD_OUTRO = "Use the layout of Image 2 and the button style of Image 3.";
const BOARD_NOTES = ["Shorter headline", "Love this hero — keep it", "This button style everywhere"];
const BOARD_LABELS = ["Today's pricing", "Option A", "Option B"];
const BOARD_VARIANTS = [0, 2, 4];

/** One board image with what's drawn on it, laid out at 420 px and scaled to `w`. */
const BoardShot: React.FC<{ i: number; w: number }> = ({ i, w }) => (
  <div style={{ width: w, height: (w * 460) / 800, overflow: "hidden", position: "relative", flex: "none" }}>
    <div style={{ width: 420, transform: `scale(${w / 420})`, transformOrigin: "0 0", position: "relative" }}>
      <Page w={420} variant={BOARD_VARIANTS[i]} />
      {i === 0 && (
        <>
          <Num n={1} size={30} style={{ position: "absolute", left: 186, top: 40 }} />
          <div style={{ position: "absolute", left: 60, top: 196, fontFamily: HAND, fontSize: 21, color: "#1e6fd9" }}>↑ too busy</div>
        </>
      )}
      {i === 1 && (
        <>
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={420} height={242}>
            <ellipse cx={318} cy={129} rx={88} ry={92} fill="none" stroke={L.pin} strokeWidth={3} />
          </svg>
          <Num n={2} size={30} style={{ position: "absolute", left: 220, top: 36 }} />
        </>
      )}
      {i === 2 && (
        <>
          <svg style={{ position: "absolute", left: 0, top: 0 }} width={420} height={242}>
            <rect x={20} y={150} width={100} height={44} rx={4} fill="none" stroke={L.pin} strokeWidth={3} />
          </svg>
          <Num n={3} size={30} style={{ position: "absolute", left: 6, top: 134 }} />
        </>
      )}
    </div>
  </div>
);

const HandText: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", fontFamily: HAND, fontSize: 25, color: "#1b1b1f", whiteSpace: "nowrap", ...style }}>{children}</div>
);

/** The board's footer bar (v1.0.3). */
const BoardBar: React.FC<{ name: string }> = ({ name }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#150f0c", borderTop: `1px solid ${L.line}`, color: L.muted, fontSize: 14 }}>
    <Btn size={14}>☰ {name}</Btn>
    <Btn size={14}>New board</Btn>
    <Btn size={14}>Add images…</Btn>
    <Btn size={14}>Clear board</Btn>
    <span style={{ flex: 1, minWidth: 0, paddingLeft: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      Drop or paste images, add text boxes and pins, then send. Images go top to bottom, left to right.
    </span>
    <Btn size={14}>Copy text</Btn>
    <Btn size={14}>
      Copy <Keys combo="Alt+C" size={15} />
    </Btn>
    <Btn primary size={14}>
      Send to Chrome <Keys combo="Ctrl+Enter" size={15} />
    </Btn>
  </div>
);

const BOARD_NAME = "Pricing redesign";

const P5Board: React.FC = () => (
  <Backdrop>
    <OrderChip n={5} title="The campaign" />
    <KeyCast combos={["Alt+B"]} />
    <Win x={110} y={170} w={1700} h={760} title="Vibius Maximus Board" kind="vibe">
      {/* Excalidraw canvas */}
      <div style={{ position: "relative", height: 478, background: "#fff" }}>
        <div style={{ position: "absolute", top: 12, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <ExcaliBar />
        </div>
        <div style={{ position: "absolute", top: 12, right: 14 }}>
          <PinTools />
        </div>
        <HandText style={{ left: 60, top: 70 }}>{BOARD_INTRO}</HandText>
        {BOARD_LABELS.map((label, i) => (
          <div key={label} style={{ position: "absolute", left: 60 + i * 540, top: 128 }}>
            <div style={{ borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 1px #ddd" }}>
              <BoardShot i={i} w={420} />
            </div>
            <div style={{ fontFamily: HAND, fontSize: 18, color: "#6b6b70", marginTop: 4 }}>{label}</div>
            {i < 2 && <div style={{ position: "absolute", left: 440, top: 100, fontSize: 40, color: "#b5b5ba" }}>→</div>}
          </div>
        ))}
        <HandText style={{ left: 60, top: 418 }}>{BOARD_OUTRO}</HandText>
      </div>
      {BOARD_NOTES.map((t, i) => (
        <NoteRow key={t} n={i + 1} text={t} active={i === 2} />
      ))}
      <BoardBar name={BOARD_NAME} />
    </Win>
    <Caption text="{Alt+B} opens the board: screenshots, *notes* and pins, in order." />
  </Backdrop>
);

const P5bBoardSend: React.FC = () => (
  <Backdrop>
    <OrderChip n={5} title="Sent in formation" />
    <KeyCast combos={["Ctrl+Enter"]} />
    <Win x={330} y={170} w={1260} h={760} title="Chat — Google Chrome">
      <Bubble me w={1000} size={20}>
        <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
              <BoardShot i={i} w={300} />
              <span style={{ position: "absolute", right: 8, bottom: 8, background: "#000b", color: "#fff", fontSize: 14, padding: "3px 8px", borderRadius: 6 }}>
                Image {i + 1}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
          {[
            "3 images attached, in the order marked below.",
            BOARD_INTRO,
            "[Image 1]",
            "[Image 2]",
            "[Image 3]",
            BOARD_OUTRO,
            ...BOARD_NOTES.map((t, i) => `${i + 1}. ${t}`),
          ].map((line) => (
            <div key={line} style={{ color: line.startsWith("[") ? L.bronze2 : "#ececec" }}>
              {line}
            </div>
          ))}
        </div>
      </Bubble>
    </Win>
    <Caption text="{Ctrl+Enter} sends every image, *labelled* to match the prompt." />
  </Backdrop>
);

const SAVED_BOARDS = [
  { name: BOARD_NAME, meta: "3 images · Oct 5", variant: 2, current: true },
  { name: "Onboarding flow", meta: "5 images · Oct 3", variant: 1 },
  { name: "Landing polish", meta: "2 images · Oct 1", variant: 5 },
];

const P5cBoards: React.FC = () => (
  <Backdrop>
    <OrderChip n={5} title="Every campaign kept" />
    <Win x={110} y={170} w={1700} h={760} title="Vibius Maximus Board" kind="vibe">
      <div style={{ position: "relative", height: 688, background: "#fff" }}>
        <div style={{ position: "absolute", inset: 0, background: "#0007" }} />
        {/* the Boards panel */}
        <div style={{ position: "absolute", left: 150, right: 150, top: 60, background: L.card, border: `1px solid ${L.line}`, borderRadius: 14, padding: "22px 26px", boxShadow: "0 30px 80px #000a" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 32, flex: 1 }}>Boards</span>
            <Btn primary size={16}>+ New board</Btn>
            <span style={{ color: L.muted, fontSize: 26, marginLeft: 8 }}>×</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {SAVED_BOARDS.map((b) => (
              <div key={b.name} style={{ flex: 1, border: `1px solid ${b.current ? L.bronze2 : L.line}`, borderRadius: 12, overflow: "hidden", background: L.card2 }}>
                <Page w={420} variant={b.variant} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: 21, fontWeight: 600, color: L.text }}>{b.name}</div>
                  <div style={{ fontSize: 16, color: L.muted, margin: "4px 0 12px" }}>{b.meta}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {b.current ? (
                      <span style={{ color: L.bronze2, fontSize: 16 }}>Open now</span>
                    ) : (
                      <>
                        <Btn size={14}>Open</Btn>
                        <Btn size={14}>Delete</Btn>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BoardBar name={BOARD_NAME} />
    </Win>
    <Caption text="Every campaign is *kept*: open, rename or start a new board." />
  </Backdrop>
);

const WALL = Array.from({ length: 15 }, (_, i) =>
  [
    "There are several ways to approach this. Option one keeps the current layout and adjusts spacing tokens across every",
    "card, which keeps the diff small but doesn't fix the hierarchy problem you mentioned. Option two rebuilds the grid with",
    "CSS subgrid so the plan columns line up, though older Safari versions need a fallback. Option three moves pricing into…",
  ][i % 3],
);

const P6aWall: React.FC = () => (
  <Backdrop>
    <OrderChip n={6} title="Standing orders" />
    <KeyCast combos={["Alt+2"]} />
    <Win x={110} y={190} w={1090} h={730} title="Chat — Google Chrome">
      <div style={{ padding: "18px 40px 0", fontSize: 15, lineHeight: 1.5, color: "#9a9aa0", WebkitMaskImage: "linear-gradient(#000 55%, transparent 92%)" }}>
        {WALL.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        {/* the macro adds its own leading space */}
        <Composer h={150} text="Which option should we ship?" insert={` ${MACRO_SUMMARY}`} />
      </div>
    </Win>
    <MacroCard lit={1} />
    <Caption text="A wall of text back? Type your follow-up, then {Alt+2}." />
  </Backdrop>
);

const P6bResearch: React.FC = () => (
  <Backdrop>
    <OrderChip n={6} title="Standing orders" />
    <KeyCast combos={["Alt+1"]} />
    <Win x={110} y={190} w={1090} h={730} title="Chat — Google Chrome">
      <Bubble me w={900} size={19}>
        How should we add rate limiting to our API?{" "}
        <span style={{ background: `${L.bronze}38`, borderRadius: 4, color: "#fff3df" }}>{MACRO_RESEARCH}</span>
      </Bubble>
      <div style={{ padding: "18px 40px 0", fontSize: 19, lineHeight: 1.5, color: "#d6d6da" }}>
        <div style={{ fontWeight: 700, color: "#fff", marginBottom: 4 }}>In short</div>
        <div>• Limit per API key with a token bucket (100 requests a minute).</div>
        <div>• Over the limit, return 429 with a Retry-After header.</div>
        <div>• Keep the counters in Redis so every server agrees.</div>
        <div style={{ fontWeight: 700, color: "#fff", margin: "14px 0 8px" }}>Worked example</div>
        <div style={{ fontFamily: MONO, fontSize: 16, lineHeight: 1.5, background: "#151517", border: "1px solid #333", borderRadius: 10, padding: "12px 16px", whiteSpace: "pre", color: "#d4d4d4" }}>
          {`import { rateLimit } from "express-rate-limit";

app.use("/api", rateLimit({
  windowMs: 60_000,            // one minute
  limit: 100,                  // per key
  keyGenerator: (req) => req.get("x-api-key") ?? req.ip,
  standardHeaders: "draft-7",  // RateLimit + Retry-After
}));`}
        </div>
      </div>
    </Win>
    <MacroCard lit={0} />
    <Caption text="A question? {Alt+1} *researches*: answer first, sources, a worked example." />
  </Backdrop>
);

// Post Process shows once AI post-processing is on, which Alt+D needs.
const NAV: [Parameters<typeof Icon>[0]["name"], string][] = [
  ["general", "General"],
  ["capture", "Capture"],
  ["macros", "Macros"],
  ["hotkeys", "Hotkeys"],
  ["captures", "Captures"],
  ["history", "History"],
  ["models", "Models"],
  ["advanced", "Advanced"],
  ["postprocess", "Post Process"],
  ["about", "About"],
];

/** The Hotkeys page shows a combo as one spaced chip: "Alt + S". */
const Chip: React.FC<{ combo: string }> = ({ combo }) => (
  <span style={{ border: `1px solid ${L.line2}`, background: "#241b16", borderRadius: 7, padding: "4px 11px", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>
    {combo.split("+").join(" + ")}
  </span>
);

const HotkeyGroup: React.FC<{ title: string; rows: [string, string][] }> = ({ title, rows }) => (
  <>
    <div style={{ fontFamily: DISPLAY, color: L.bronze2, letterSpacing: "0.2em", fontSize: 14, margin: "14px 0 7px" }}>{title}</div>
    <div style={{ border: `1px solid ${L.line}`, borderRadius: 12, background: L.card }}>
      {rows.map(([label, combo], i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", padding: "6px 20px", borderTop: i ? `1px solid ${L.line}` : undefined, fontSize: 16 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>
            {label} <span style={{ color: L.muted, fontWeight: 400, fontSize: 14 }}>ⓘ</span>
          </span>
          <Chip combo={combo} />
          <span style={{ marginLeft: 12, color: L.muted }}>↻</span>
        </div>
      ))}
    </div>
  </>
);

const P7Hotkeys: React.FC = () => (
  <Backdrop>
    <OrderChip n={7} title="Headquarters" />
    <Win x={330} y={150} w={1260} h={800} title="Vibius Maximus" kind="vibe">
      <div style={{ display: "flex", height: "100%" }}>
        <div style={{ width: 300, background: "#1d1612", borderRight: `1px solid ${L.line}`, padding: "26px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 10px 22px" }}>
            <ShieldMark size={64} />
            <Wordmark size={21} stacked />
          </div>
          <div style={{ height: 1, background: `${L.bronze}73`, margin: "0 6px 16px" }} />
          {NAV.map(([icon, label]) => {
            const active = icon === "hotkeys";
            return (
              <div
                key={icon}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "10px 14px",
                  borderRadius: 9,
                  fontSize: 20,
                  fontWeight: 600,
                  color: active ? L.bronze2 : "#d9ccb9",
                  background: active ? `${L.bronze2}21` : undefined,
                  boxShadow: active ? `inset 3px 0 0 ${L.bronze2}` : undefined,
                }}
              >
                <Icon name={icon} size={23} />
                {label}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, padding: "20px 40px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Tile name="hotkeys" size={48} />
            <span style={{ fontFamily: DISPLAY, fontSize: 36 }}>Hotkeys</span>
          </div>
          <HotkeyGroup
            title="EVERYWHERE"
            rows={[
              ["Transcribe Shortcut", "Ctrl+Space"],
              ["Cancel Shortcut", "Escape"],
              ["Capture Shortcut", "Alt+S"],
              ["Board Shortcut", "Alt+B"],
              ["Paste copied capture", "Alt+V"],
            ]}
          />
          <HotkeyGroup
            title="CAPTURE EDITOR AND BOARD"
            rows={[
              ["Pin", "Alt+`"],
              ["Number shapes", "Alt+N"],
              ["Copy", "Alt+C"],
              ["Send", "Ctrl+Enter"],
              ["Send and submit", "Ctrl+Shift+Enter"],
              ["Add to board", "Alt+Enter"],
              ["AI clean up", "Alt+D"],
              ["Close", "Esc"],
            ]}
          />
        </div>
      </div>
    </Win>
    <Caption text="Every key at its post, and *every one* yours to change." />
  </Backdrop>
);

const FACTS = [
  ["models", "Offline speech"],
  ["history", "Sleeps when idle"],
  ["captures", "18 MB installer"],
] as const;

const P8Outro: React.FC = () => (
  <Backdrop>
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
        <ShieldMark size={170} style={{ filter: `drop-shadow(0 0 50px ${L.red}55)` }} />
        <Wordmark size={64} stacked />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 84, color: L.bronze2, letterSpacing: "0.08em", marginTop: 50 }}>{TAGLINE}</div>
      <div style={{ display: "flex", gap: 70, marginTop: 56 }}>
        {FACTS.map(([icon, label]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: L.text }}>
            <Tile name={icon} size={46} />
            {label}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 60, fontSize: 26, color: L.muted, letterSpacing: "0.04em" }}>github.com/bay714/VibiusMaximus</div>
    </div>
  </Backdrop>
);

/* ------------------------------------------------------------------ the board */

export type Panel = {
  id: string;
  time: string;
  title: string;
  vo: string;
  note: string;
  C: React.FC;
};

export const PANELS: Panel[] = [
  {
    id: "00-title",
    time: "0:00–0:06",
    title: "Cold open",
    vo: "Commander. Your legion awaits orders. Here's how you give them.",
    note: "Drum hit. Shield draws on (rim → red → spine → boss → VM), tagline stamps in.",
    C: P0Title,
  },
  {
    id: "01-dictate",
    time: "0:06–0:13",
    title: "I · Give the order",
    vo: "Hold Control Space and give the order. It runs offline, in any app, right at your cursor.",
    note: "Text lands all at once on release (not typed out). Offline after the one-time model download.",
    C: P1Dictate,
  },
  {
    id: "02-capture",
    time: "0:13–0:30",
    title: "II · Mark the target",
    vo: "Alt S freezes the screen. Box it and it's numbered; write on it; drop a pin. Say a note for each. Alt D tidies the wording.",
    note: "Rectangle ①, Text tool '↖ more breathing room' (text isn't numbered), Pin ②. Alt+D needs an AI provider on the recording PC.",
    C: P2Capture,
  },
  {
    id: "03-send",
    time: "0:30–0:39",
    title: "III · Dispatch",
    vo: "Control Enter dispatches it: the image first, then the numbered notes. Terminals get a file path, ready for Claude Code.",
    note: "Image carries the caption strip. Editor just closes (no toast). Use Windows Terminal, not VS Code's terminal.",
    C: P3Send,
  },
  {
    id: "04-carry",
    time: "0:39–0:48",
    title: "IV · The courier",
    vo: "Alt C copies it all. Alt V, in any app, delivers the image and the text. Double-click any capture to reopen it.",
    note: "Alt+C closes the editor. Alt+V works once, in any app, for 5 minutes.",
    C: P4Carry,
  },
  {
    id: "05a-board",
    time: "0:48–0:59",
    title: "V · The campaign",
    vo: "A bigger campaign? Alt B opens the board. Drop in screenshots, write between them, circle and pin what matters.",
    note: "Pin ①, circle ②, box ③ (every shape numbers). 'too busy' on image 1 is drawn into it; text between images is the prompt.",
    C: P5Board,
  },
  {
    id: "05b-board-send",
    time: "0:59–1:06",
    title: "V · Sent in formation",
    vo: "Control Enter sends every image in reading order, labelled to match your prompt.",
    note: "Exact compile.ts output. The marks are drawn into each image; images paste first, then the text.",
    C: P5bBoardSend,
  },
  {
    id: "05c-boards",
    time: "1:06–1:09",
    title: "V · Every campaign kept",
    vo: "Every campaign is kept.",
    note: "Click '☰ Pricing redesign' → Boards panel: preview, 'N images · date', Open / Delete, click a name to rename, + New board.",
    C: P5cBoards,
  },
  {
    id: "06a-macros-wall",
    time: "1:09–1:17",
    title: "VI · Standing orders",
    vo: "Got a wall of text back? Type your follow-up, then Alt 2 asks for the short version.",
    note: "Summarize (Alt+2, v1.0.4). No trailing space before Alt+2; the macro adds one.",
    C: P6aWall,
  },
  {
    id: "06b-macros-research",
    time: "1:17–1:26",
    title: "VI · Standing orders (2)",
    vo: "Need research? Alt 1 orders a concise answer, then a detailed, worked example. One key, your favourite prompts.",
    note: "Research (Alt+1, v1.0.4).",
    C: P6bResearch,
  },
  {
    id: "07-hotkeys",
    time: "1:26–1:32",
    title: "VII · Headquarters",
    vo: "Every key at its post, and every one yours to change.",
    note: "Real labels and spaced chips. Post Process shows because AI is on (for Alt+D). MACROS and DRAWING TOOLS sections are below.",
    C: P7Hotkeys,
  },
  {
    id: "08-outro",
    time: "1:32–1:40",
    title: "Finale",
    vo: "Light enough to march anywhere. Vibius Maximus. Veni, vidi, vibed.",
    note: "Facts as measured: offline speech, sleeps when idle, 18 MB installer (not signed; updates are).",
    C: P8Outro,
  },
];
