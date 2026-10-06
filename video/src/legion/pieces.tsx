// Live (animatable) versions of the storyboard's app mock-ups. All layouts match
// storyboard v3, which the app's build thread checked against v1.0.3.
import React from "react";
import {
  DISPLAY,
  ExcaliBar,
  HAND,
  Icon,
  Keys,
  L,
  MONO,
  Num,
  Page,
  SANS,
  ShieldMark,
  Tile,
  Win,
  Wordmark,
} from "./kit";

/* ------------------------------------------------------------------ copy */

export const CAPTION_RAMBLE =
  "um so basically make the whole landing page feel, like, more premium I guess";
export const CAPTION = "Make the landing page feel more premium";
export const NOTE_1 = "Bigger button, in our bronze";
export const NOTE_2 = "Swap this for a real product shot";
export const SCRIBBLE = "↖ more breathing room";
export const CAPTURE_TEXT = [
  "[screenshot above]",
  CAPTION,
  `1. ${NOTE_1}`,
  `2. ${NOTE_2}`,
];
export const CAPTURE_FILE = "capture-20261005-101530123.png";
export const CAPTURE_PATH = `C:\\Users\\you\\AppData\\Roaming\\com.bay714.vibiusmaximus\\captures\\${CAPTURE_FILE}`;

// The five starter macros in v1.0.4 (src-tauri/src/vibe/macros.rs). On screen only the first
// line of each is shown being inserted; the full texts are long.
export const MACROS = [
  ["Alt+1", "Plan"],
  ["Alt+2", "Scope"],
  ["Alt+3", "Research"],
  ["Alt+4", "Summarize"],
  ["Alt+5", "Execute"],
];
export const MACRO_FIRST = {
  plan: "Plan this before touching any code. Read the relevant code first, then:",
  scope:
    "Fully scope this so a builder who has never seen this conversation can deliver it without guessing.",
  research:
    "Research this before answering. Prefer primary sources (official docs, changelogs, specs, source code)",
  summarize: "Summarize the above for someone who wasn't following along.",
  execute:
    "Execute this as the orchestrator, not the builder. Work from the agreed scope or plan.",
};

/* ------------------------------------------------------------------ small parts */

export const Btn: React.FC<{
  children: React.ReactNode;
  primary?: boolean;
  size?: number;
  glow?: number;
}> = ({ children, primary, size = 17, glow = 0 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: primary ? L.red2 : "#241b16",
      border: `1px solid ${primary ? L.red2 : glow > 0 ? L.bronze2 : L.line}`,
      color: primary ? "#fff" : L.text,
      borderRadius: 9,
      padding: `${size * 0.45}px ${size * 0.8}px`,
      fontSize: size,
      fontWeight: primary ? 600 : 400,
      whiteSpace: "nowrap",
      flex: "none",
      boxShadow:
        glow > 0
          ? `0 0 ${24 * glow}px ${primary ? L.red2 : L.bronze2}`
          : undefined,
      transform: glow > 0 ? `scale(${1 + 0.04 * glow})` : undefined,
    }}
  >
    {children}
  </span>
);

/**
 * "① Pin Alt+`", "# Number shapes Alt+N" (on), Excalidraw's Library. `pinArmed` lights Pin;
 * `spotlight` rings one of the two with a bronze glow while the video explains it.
 */
export const PinTools: React.FC<{
  pinArmed?: boolean;
  spotlight?: "pin" | "shapes" | null;
}> = ({ pinArmed, spotlight }) => (
  <div style={{ display: "flex", gap: 8 }}>
    {(
      [
        ["① Pin", "Alt+`", !!pinArmed, "pin"],
        ["# Number shapes", "Alt+N", true, "shapes"],
        ["▤ Library", "", false, ""],
      ] as const
    ).map(([label, key, on, id]) => (
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
          boxShadow:
            spotlight && spotlight === id
              ? `0 0 0 3px ${L.bronze2}, 0 0 28px ${L.bronze2}`
              : "0 1px 3px #0002",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        {key && (
          <span style={{ fontSize: 13, opacity: 0.75, marginLeft: 8 }}>
            {key}
          </span>
        )}
      </span>
    ))}
  </div>
);

export const NoteRow: React.FC<{
  n: number;
  text: string;
  placeholder?: string;
  active?: boolean;
  listening?: boolean;
}> = ({ n, text, placeholder, active, listening }) => (
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
    <Num
      n={n}
      size={28}
      style={active ? { boxShadow: "0 0 0 2px #fff" } : undefined}
    />
    <span style={{ flex: 1, color: text ? L.text : L.muted }}>
      {text || placeholder}
    </span>
    {listening && <Listening />}
    <span style={{ color: L.muted }}>×</span>
  </div>
);

/** A small "listening" indicator: red dot and bronze bars. */
export const Listening: React.FC<{ f?: number }> = () => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      marginRight: 8,
    }}
  >
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: 5,
        background: L.red2,
        marginRight: 4,
        boxShadow: `0 0 8px ${L.red2}`,
      }}
    />
    {[8, 14, 20, 12, 18, 10].map((h, i) => (
      <span
        key={i}
        style={{ width: 3, height: h, borderRadius: 2, background: L.bronze2 }}
      />
    ))}
  </span>
);

/* ------------------------------------------------------------------ capture editor */

export type EditorState = {
  /** 0→1 draws the rectangle round the button. */
  rect: number;
  /** pop progress of number ① and ② (0 = hidden). */
  num1: number;
  num2: number;
  /** Text-tool note typed so far. */
  scribble: string;
  tool?: "text" | "pin" | "rect" | "select";
  /** Note rows shown (null = no row yet). */
  notes: [string | null, string | null];
  caption: string;
  /** Which row is listening to dictation: "caption", 1, 2. */
  listening?: "caption" | 1 | 2 | null;
  active?: 1 | 2 | null;
  /** 0→1 shimmer on the caption while AI clean-up runs. */
  cleaning?: number;
  /** Glow on a footer button. */
  glow?: "send" | "copy" | null;
  /** Rings the Pin or Number shapes button while the video explains it. */
  spotlight?: "pin" | "shapes" | null;
  /** The window captured from (where Send pastes), as the Send button names it. */
  target?: string;
};

export const EDITOR_DONE: EditorState = {
  rect: 1,
  num1: 1,
  num2: 1,
  scribble: SCRIBBLE,
  notes: [NOTE_1, NOTE_2],
  caption: CAPTION,
  active: 1,
  target: "Terminal",
};

/** The marks on the screenshot, in the mock page's 800×460 space. */
const Marks: React.FC<{ s: EditorState }> = ({ s }) => (
  <div
    style={{ position: "absolute", left: 0, top: 0, width: 800, height: 460 }}
  >
    <svg style={{ position: "absolute", inset: 0 }} width={800} height={460}>
      {s.rect > 0 && (
        <rect
          x={42}
          y={290}
          width={180}
          height={74}
          rx={6}
          fill="none"
          stroke={L.pin}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - s.rect}
        />
      )}
    </svg>
    {s.num1 > 0 && (
      <Num
        n={1}
        size={34}
        style={{
          position: "absolute",
          left: 24,
          top: 272,
          transform: `scale(${s.num1})`,
        }}
      />
    )}
    {s.scribble && (
      <div
        style={{
          position: "absolute",
          left: 150,
          top: 376,
          fontFamily: HAND,
          fontSize: 24,
          color: "#1e6fd9",
          whiteSpace: "nowrap",
        }}
      >
        {s.scribble}
        {s.tool === "text" && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 26,
              background: "#1e6fd9",
              verticalAlign: "middle",
            }}
          />
        )}
      </div>
    )}
    {s.num2 > 0 && (
      <Num
        n={2}
        size={34}
        style={{
          position: "absolute",
          left: 714,
          top: 80,
          transform: `scale(${s.num2})`,
        }}
      />
    )}
  </div>
);

export const Editor: React.FC<{ s: EditorState; scale?: number }> = ({
  s,
  scale = 1,
}) => {
  const cleaning = s.cleaning ?? 0;
  return (
    <div
      style={{
        width: 980,
        transform: `scale(${scale})`,
        transformOrigin: "0 0",
        background: L.card,
        border: `1px solid ${L.line}`,
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 30px 90px #000c",
        fontSize: 18,
        fontFamily: SANS,
        color: L.text,
      }}
    >
      <div style={{ position: "relative" }}>
        <Page w={980} />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `scale(${980 / 800})`,
            transformOrigin: "0 0",
          }}
        >
          <Marks s={s} />
        </div>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <ExcaliBar scale={0.9} />
        </div>
        <div style={{ position: "absolute", top: 62, right: 12 }}>
          <PinTools pinArmed={s.tool === "pin"} spotlight={s.spotlight} />
        </div>
      </div>
      {/* caption row, Clean up at its right end */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "10px 16px",
          borderTop: `1px solid ${L.line}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span style={{ color: L.bronze2, width: 28, textAlign: "center" }}>
          ✎
        </span>
        <span
          style={{
            flex: 1,
            color: s.caption ? L.text : L.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {s.caption ||
            "Say or type what to change… (hold Ctrl+Space to dictate)"}
        </span>
        {s.listening === "caption" && <Listening />}
        <Btn size={15} glow={cleaning > 0 && cleaning < 1 ? 1 : 0}>
          ✨ Clean up <Keys combo="Alt+D" size={16} />
        </Btn>
        {cleaning > 0 && cleaning < 1 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(100deg, transparent ${cleaning * 120 - 30}%, ${L.bronze2}40 ${cleaning * 120 - 10}%, transparent ${cleaning * 120 + 10}%)`,
            }}
          />
        )}
      </div>
      {s.notes[0] !== null && (
        <NoteRow
          n={1}
          text={s.notes[0]}
          placeholder="Note for pin 1…"
          active={s.active === 1}
          listening={s.listening === 1}
        />
      )}
      {s.notes[1] !== null && (
        <NoteRow
          n={2}
          text={s.notes[1]}
          placeholder="Note for pin 2…"
          active={s.active === 2}
          listening={s.listening === 2}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "#150f0c",
          borderTop: `1px solid ${L.line}`,
          color: L.muted,
          fontSize: 14,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.tool === "pin" ? (
            <span style={{ color: L.bronze2 }}>
              Click where the pin goes · Esc to cancel
            </span>
          ) : (
            "Alt+C copies · then Alt+V in any app pastes the image and the text"
          )}
        </span>
        <Btn size={14}>
          Cancel <Keys combo="Esc" size={15} />
        </Btn>
        <Btn size={14}>
          Add to board <Keys combo="Alt+Enter" size={15} />
        </Btn>
        <Btn size={14} glow={s.glow === "copy" ? 1 : 0}>
          Copy <Keys combo="Alt+C" size={15} />
        </Btn>
        <Btn size={14}>
          Send + submit <Keys combo="Ctrl+Shift+Enter" size={15} />
        </Btn>
        <Btn primary size={14} glow={s.glow === "send" ? 1 : 0}>
          Send to {s.target ?? "Chrome"} <Keys combo="Ctrl+Enter" size={15} />
        </Btn>
      </div>
    </div>
  );
};

/** The sent image: marked-up shot plus the caption strip printed along its bottom. */
export const SentShot: React.FC<{ w: number; style?: React.CSSProperties }> = ({
  w,
  style,
}) => (
  <div
    style={{
      width: w,
      borderRadius: 10,
      overflow: "hidden",
      flex: "none",
      ...style,
    }}
  >
    <div style={{ position: "relative" }}>
      <Page w={w} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transform: `scale(${w / 800})`,
          transformOrigin: "0 0",
        }}
      >
        <Marks s={EDITOR_DONE} />
      </div>
    </div>
    <div
      style={{
        background: "#1b1512",
        color: "#f1e6d6",
        fontFamily: SANS,
        fontSize: w * 0.026,
        lineHeight: 1.4,
        padding: `${w * 0.015}px ${w * 0.025}px`,
      }}
    >
      <div style={{ fontWeight: 600 }}>{CAPTION}</div>
      <div style={{ opacity: 0.85 }}>
        ① {NOTE_1} · ② {NOTE_2}
      </div>
    </div>
  </div>
);

/* ------------------------------------------------------------------ chat app */

export const Bubble: React.FC<{
  me?: boolean;
  children: React.ReactNode;
  w?: number;
  size?: number;
  style?: React.CSSProperties;
}> = ({ me, children, w = 560, size = 21, style }) => (
  <div
    style={{
      display: "flex",
      justifyContent: me ? "flex-end" : "flex-start",
      padding: "0 40px",
      marginTop: 22,
      ...style,
    }}
  >
    <div
      style={{
        maxWidth: w,
        background: me ? "#303033" : "transparent",
        borderRadius: 18,
        padding: me ? "14px 20px" : "4px 0",
        fontSize: size,
        lineHeight: 1.45,
        color: me ? "#ececec" : "#bdbdc2",
        fontFamily: SANS,
      }}
    >
      {children}
    </div>
  </div>
);

export const Composer: React.FC<{
  text: string;
  insert?: string;
  h?: number;
  caret?: boolean;
  flash?: number;
}> = ({ text, insert, h = 96, caret = true, flash = 0 }) => (
  <div
    style={{
      margin: "0 40px 30px",
      minHeight: h,
      borderRadius: 18,
      background: "#2b2b2e",
      border: `1px solid ${flash > 0 ? L.bronze2 : "#3b3b3e"}`,
      boxShadow: flash > 0 ? `0 0 ${30 * flash}px ${L.bronze}66` : undefined,
      padding: "18px 22px",
      fontSize: 22,
      lineHeight: 1.45,
      color: "#ececec",
      whiteSpace: "pre-wrap",
      fontFamily: SANS,
    }}
  >
    {text || insert ? null : <span style={{ color: "#8a8a90" }}>Message…</span>}
    {text}
    {insert && (
      <span
        style={{
          background: `${L.bronze}38`,
          boxShadow: `0 0 0 2px ${L.bronze}38`,
          borderRadius: 4,
          color: "#fff3df",
        }}
      >
        {insert}
      </span>
    )}
    {caret && (
      <span
        style={{
          display: "inline-block",
          width: 2,
          height: 26,
          background: "#ececec",
          verticalAlign: "middle",
          marginLeft: 2,
        }}
      />
    )}
  </div>
);

/* ------------------------------------------------------------------ settings window */

/** What each starter macro does: the build thread's table for v1.0.4, word for word. */
export const MACRO_DOES = [
  "For a task you're doing now: restates the goal and what \"done\" means, asks up to 3 questions if anything's unclear, then gives files, steps, how each step is checked, and risks. Writes no code until you say OK.",
  "A full spec a builder can follow without guessing, with non-goals, testable acceptance criteria, constraints, small tasks each with its own check, review gates, risks and assumptions.",
  "Primary sources first, the answer up front, a source for each finding, fact kept separate from guesswork, a worked example, and what to double-check.",
  "A one-line bottom line, then each topic with background, status and next step, then the decisions needed from you, in under 200 words.",
  "The AI becomes the orchestrator: a self-contained brief per builder, no two builders on the same files, parallel where possible, a fresh reviewer that accepts evidence rather than claims, no widening of scope, and a final report with evidence.",
];

/**
 * Settings → Macros (the window is just "Vibius Maximus"). The lit row opens up to show what
 * that macro does; the five are starters, and "New macro" adds more.
 */
export const MacroCard: React.FC<{
  lit: number | null;
  x?: number;
  y?: number;
  /** Open the lit row to show what it does (off for the quick sweep). */
  expand?: boolean;
  /** Glow on "New macro". */
  glowNew?: number;
  /** A macro the user added, shown after the starters. */
  extra?: [string, string];
}> = ({ lit, x = 1240, y = 200, expand = true, glowNew = 0, extra }) => (
  <Win x={x} y={y} w={600} h={680} title="Vibius Maximus" kind="vibe">
    <div style={{ padding: "20px 22px", fontFamily: SANS, color: L.text }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <Tile name="macros" size={44} />
        <span style={{ fontFamily: DISPLAY, fontSize: 32 }}>Macros</span>
      </div>
      <div
        style={{
          border: `1px solid ${L.line}`,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {MACROS.map(([key, name], i) => {
          const on = i === lit;
          return (
            <div
              key={key}
              style={{
                padding: on ? "14px 16px 16px" : "12px 16px",
                borderTop: i ? `1px solid ${L.line}` : undefined,
                background: on ? `${L.bronze2}22` : L.card,
                boxShadow: on ? `inset 4px 0 0 ${L.bronze2}` : undefined,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 20,
                }}
              >
                <Keys combo={key} size={24} lit={on} />
                <span
                  style={{
                    color: on ? L.bronze2 : L.text,
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {name}
                </span>
              </div>
              {on && expand && (
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.45,
                    color: "#e6d9c6",
                    marginTop: 8,
                  }}
                >
                  {MACRO_DOES[i]}
                </div>
              )}
            </div>
          );
        })}
        {extra && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 16px",
              borderTop: `1px solid ${L.line}`,
              background: L.card,
              fontSize: 20,
            }}
          >
            <Keys combo={extra[0]} size={24} />
            <span>{extra[1]}</span>
            <span style={{ fontSize: 14, color: L.bronze2, marginLeft: "auto" }}>yours</span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderTop: `1px solid ${L.line}`,
            background: L.card,
            fontSize: 17,
            color: L.muted,
          }}
        >
          <span
            style={{
              border: `1px solid ${glowNew > 0 ? L.bronze2 : L.line2}`,
              boxShadow:
                glowNew > 0 ? `0 0 ${20 * glowNew}px ${L.bronze2}` : undefined,
              borderRadius: 8,
              padding: "4px 10px",
              color: glowNew > 0 ? L.bronze2 : L.text,
            }}
          >
            + New macro
          </span>
          Add your own, each on its own key
        </div>
      </div>
    </div>
  </Win>
);

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

/** The settings sidebar; `lit` (0→NAV.length) sweeps a highlight down, `active` is the selected item. */
export const Sidebar: React.FC<{ active: string; sweep?: number }> = ({
  active,
  sweep = -1,
}) => (
  <div
    style={{
      width: 300,
      background: "#1d1612",
      borderRight: `1px solid ${L.line}`,
      padding: "26px 16px",
      fontFamily: SANS,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 10px 22px",
      }}
    >
      <ShieldMark size={64} />
      <Wordmark size={21} stacked />
    </div>
    <div
      style={{ height: 1, background: `${L.bronze}73`, margin: "0 6px 16px" }}
    />
    {NAV.map(([icon, label], i) => {
      const on = icon === active;
      const glint = Math.max(0, 1 - Math.abs(sweep - i));
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
            color: on || glint > 0.3 ? L.bronze2 : "#d9ccb9",
            background: on
              ? `${L.bronze2}21`
              : glint > 0
                ? `rgba(212,161,87,${0.12 * glint})`
                : undefined,
            boxShadow: on ? `inset 3px 0 0 ${L.bronze2}` : undefined,
          }}
        >
          <Icon name={icon} size={23} />
          {label}
        </div>
      );
    })}
  </div>
);

const Chip: React.FC<{ combo: string }> = ({ combo }) => (
  <span
    style={{
      border: `1px solid ${L.line2}`,
      background: "#241b16",
      borderRadius: 7,
      padding: "4px 11px",
      fontSize: 16,
      fontWeight: 600,
      whiteSpace: "nowrap",
    }}
  >
    {combo.split("+").join(" + ")}
  </span>
);

export const HOTKEYS: [string, [string, string][]][] = [
  [
    "EVERYWHERE",
    [
      ["Transcribe Shortcut", "Ctrl+Space"],
      ["Cancel Shortcut", "Escape"],
      ["Capture Shortcut", "Alt+S"],
      ["Board Shortcut", "Alt+B"],
      ["Paste copied capture", "Alt+V"],
    ],
  ],
  [
    "CAPTURE EDITOR AND BOARD",
    [
      ["Pin", "Alt+`"],
      ["Number shapes", "Alt+N"],
      ["Copy", "Alt+C"],
      ["Send", "Ctrl+Enter"],
      ["Send and submit", "Ctrl+Shift+Enter"],
      ["Add to board", "Alt+Enter"],
      ["AI clean up", "Alt+D"],
      ["Close", "Esc"],
    ],
  ],
];

/** The Hotkeys page; `rows` = how many rows are shown so far (for a staggered reveal). */
export const HotkeysPage: React.FC<{ rows: number }> = ({ rows }) => {
  let k = 0;
  return (
    <div
      style={{ flex: 1, padding: "20px 40px", fontFamily: SANS, color: L.text }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Tile name="hotkeys" size={48} />
        <span style={{ fontFamily: DISPLAY, fontSize: 36 }}>Hotkeys</span>
      </div>
      {HOTKEYS.map(([title, list]) => (
        <React.Fragment key={title}>
          <div
            style={{
              fontFamily: DISPLAY,
              color: L.bronze2,
              letterSpacing: "0.2em",
              fontSize: 14,
              margin: "14px 0 7px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              border: `1px solid ${L.line}`,
              borderRadius: 12,
              background: L.card,
            }}
          >
            {list.map(([label, combo], i) => {
              const shown = k++ < rows;
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "6px 20px",
                    borderTop: i ? `1px solid ${L.line}` : undefined,
                    fontSize: 16,
                    opacity: shown ? 1 : 0.15,
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 600 }}>
                    {label}{" "}
                    <span
                      style={{ color: L.muted, fontWeight: 400, fontSize: 14 }}
                    >
                      ⓘ
                    </span>
                  </span>
                  <Chip combo={combo} />
                  <span style={{ marginLeft: 12, color: L.muted }}>↻</span>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ board */

export const BOARD_INTRO = "Redesign the pricing page to match our new brand.";
export const BOARD_OUTRO =
  "Use the layout of Image 2 and the button style of Image 3.";
export const BOARD_NOTES = [
  "Shorter headline",
  "Love this hero — keep it",
  "This button style everywhere",
];
export const BOARD_LABELS = ["Today's pricing", "Option A", "Option B"];
export const BOARD_NAME = "Pricing redesign";
const BOARD_VARIANTS = [0, 2, 4];

export type ShotMarks = {
  pin?: number;
  busy?: string;
  circle?: number;
  num2?: number;
  box?: number;
  num3?: number;
};
export const MARKS_DONE: ShotMarks = {
  pin: 1,
  busy: "↑ too busy",
  circle: 1,
  num2: 1,
  box: 1,
  num3: 1,
};

/** One board image with what's drawn on it, laid out at 420 px and scaled to `w`. */
export const BoardShot: React.FC<{ i: number; w: number; m?: ShotMarks }> = ({
  i,
  w,
  m = MARKS_DONE,
}) => (
  <div
    style={{
      width: w,
      height: (w * 460) / 800,
      overflow: "hidden",
      position: "relative",
      flex: "none",
    }}
  >
    <div
      style={{
        width: 420,
        transform: `scale(${w / 420})`,
        transformOrigin: "0 0",
        position: "relative",
      }}
    >
      <Page w={420} variant={BOARD_VARIANTS[i]} />
      {i === 0 && (
        <>
          {(m.pin ?? 0) > 0 && (
            <Num
              n={1}
              size={30}
              style={{
                position: "absolute",
                left: 186,
                top: 40,
                transform: `scale(${m.pin})`,
              }}
            />
          )}
          {m.busy && (
            <div
              style={{
                position: "absolute",
                left: 60,
                top: 196,
                fontFamily: HAND,
                fontSize: 21,
                color: "#1e6fd9",
                whiteSpace: "nowrap",
              }}
            >
              {m.busy}
            </div>
          )}
        </>
      )}
      {i === 1 && (
        <>
          <svg
            style={{ position: "absolute", left: 0, top: 0 }}
            width={420}
            height={242}
          >
            {(m.circle ?? 0) > 0 && (
              <ellipse
                cx={318}
                cy={129}
                rx={88}
                ry={92}
                fill="none"
                stroke={L.pin}
                strokeWidth={3}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - (m.circle ?? 0)}
              />
            )}
          </svg>
          {(m.num2 ?? 0) > 0 && (
            <Num
              n={2}
              size={30}
              style={{
                position: "absolute",
                left: 220,
                top: 36,
                transform: `scale(${m.num2})`,
              }}
            />
          )}
        </>
      )}
      {i === 2 && (
        <>
          <svg
            style={{ position: "absolute", left: 0, top: 0 }}
            width={420}
            height={242}
          >
            {(m.box ?? 0) > 0 && (
              <rect
                x={20}
                y={150}
                width={100}
                height={44}
                rx={4}
                fill="none"
                stroke={L.pin}
                strokeWidth={3}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - (m.box ?? 0)}
              />
            )}
          </svg>
          {(m.num3 ?? 0) > 0 && (
            <Num
              n={3}
              size={30}
              style={{
                position: "absolute",
                left: 6,
                top: 134,
                transform: `scale(${m.num3})`,
              }}
            />
          )}
        </>
      )}
    </div>
  </div>
);

export const BoardBar: React.FC<{ glow?: "send" | "menu" | null }> = ({
  glow,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 14px",
      background: "#150f0c",
      borderTop: `1px solid ${L.line}`,
      color: L.muted,
      fontSize: 14,
      fontFamily: SANS,
    }}
  >
    <Btn size={14} glow={glow === "menu" ? 1 : 0}>
      ☰ {BOARD_NAME}
    </Btn>
    <Btn size={14}>New board</Btn>
    <Btn size={14}>Add images…</Btn>
    <Btn size={14}>Clear board</Btn>
    <span
      style={{
        flex: 1,
        minWidth: 0,
        paddingLeft: 6,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      Drop or paste images, add text boxes and pins, then send. Images go top to
      bottom, left to right.
    </span>
    <Btn size={14}>Copy text</Btn>
    <Btn size={14}>
      Copy <Keys combo="Alt+C" size={15} />
    </Btn>
    <Btn primary size={14} glow={glow === "send" ? 1 : 0}>
      Send to Chrome <Keys combo="Ctrl+Enter" size={15} />
    </Btn>
  </div>
);

export const HandText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      fontFamily: HAND,
      fontSize: 25,
      color: "#1b1b1f",
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

export { MONO };
