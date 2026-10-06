import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  DISPLAY,
  KeyCast,
  Keys,
  L,
  MONO,
  SANS,
  SceneFade,
  Sfx,
  SlideIn,
  Win,
} from "../kit";
import {
  Bubble,
  CAPTION,
  CAPTURE_FILE,
  CAPTURE_PATH,
  CAPTURE_TEXT,
  EDITOR_DONE,
  Editor,
  NOTE_1,
  NOTE_2,
  SentShot,
} from "../pieces";

// Send goes to the window that was in front when Alt+S was pressed (the terminal clicked in
// the last scene); the button names it. VO: "07-send" at 9, "08-terminal" at 228.
const SEND = 200; // Ctrl+Enter
const TERM = 214; // the terminal comes forward
const TERM_PASTE = 228;
const CHAT = 300; // the same capture, had you clicked a chat box first

const TermLine: React.FC<{ at: number; children: React.ReactNode }> = ({
  at,
  children,
}) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  return <div style={{ opacity: ramp(f, at, at + 6) }}>{children}</div>;
};

/** A side card (video graphic, not app UI). */
const Note: React.FC<{
  at: number;
  out: number;
  style: React.CSSProperties;
  title: string;
  children: React.ReactNode;
}> = ({ at, out, style, title, children }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = pop(f, at) * (1 - ramp(f, out, out + 10));
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        width: 390,
        padding: "24px 26px 22px",
        borderRadius: 18,
        background: L.card,
        border: `1px solid ${L.bronze2}`,
        boxShadow: `0 24px 60px #000b, 0 0 30px ${L.bronze}33`,
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 20}px)`,
        fontFamily: SANS,
        color: "#d9ccb9",
        fontSize: 21,
        lineHeight: 1.45,
        zIndex: 40,
        ...style,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 30,
          color: L.text,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
};

export const S3Send: React.FC = () => {
  const f = useCurrentFrame();
  const closing = ramp(f, SEND + 4, SEND + 16);
  const pulse = f < SEND ? 0.5 + 0.5 * Math.sin(f / 6) : 1;
  const chatTag = pop(f, CHAT + 6);
  return (
    <SceneFade>
      <Backdrop>
        {/* the terminal: where this capture goes, because it was clicked before Alt+S */}
        <SlideIn at={TERM} dy={30}>
          <Win
            x={90}
            y={190}
            w={1000}
            h={700}
            title="Windows Terminal — claude"
            kind="terminal"
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: 18,
                lineHeight: 1.55,
                color: "#d4d4d4",
                padding: "18px 22px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              <TermLine at={TERM + 2}>
                <span style={{ color: L.bronze2 }}>{"> "}</span>
                {f >= TERM_PASTE ? CAPTURE_PATH : ""}
              </TermLine>
              <TermLine
                at={TERM_PASTE + 6}
              >{`  ${CAPTION}\n  1. ${NOTE_1}\n  2. ${NOTE_2}\n `}</TermLine>
              <TermLine at={TERM_PASTE + 30}>
                <span style={{ color: "#9cdcfe" }}>●</span> Read({CAPTURE_FILE})
              </TermLine>
              <TermLine at={TERM_PASTE + 48}>
                <span style={{ color: "#9cdcfe" }}>●</span> Task(Restyle the CTA
                button)
              </TermLine>
              <TermLine at={TERM_PASTE + 58}>
                <span style={{ color: "#9cdcfe" }}>●</span> Task(Replace hero
                illustration)
              </TermLine>
              <TermLine at={TERM_PASTE + 72}>
                <span style={{ color: "#8a8a8a" }}>
                  {"  ⎿ 2 subagents running…"}
                </span>
              </TermLine>
            </div>
          </Win>
        </SlideIn>

        {/* the alternative: a chat box clicked before Alt+S gets the image and the notes */}
        <SlideIn at={CHAT} dx={70} dy={0}>
          <Win x={1130} y={250} w={720} h={680} title="Chat — Google Chrome">
            <Bubble me w={520} size={18}>
              <SentShot w={460} style={{ marginBottom: 10 }} />
              {CAPTURE_TEXT.map((l) => (
                <div
                  key={l}
                  style={{ color: l.startsWith("[") ? L.bronze2 : undefined }}
                >
                  {l}
                </div>
              ))}
            </Bubble>
          </Win>
        </SlideIn>
        {f >= CHAT + 6 && (
          <div
            style={{
              position: "absolute",
              left: 1130,
              width: 720,
              top: 196,
              textAlign: "center",
              fontFamily: DISPLAY,
              fontSize: 26,
              color: L.bronze2,
              opacity: chatTag,
            }}
          >
            Clicked a chat box before Alt+S? It lands there.
          </div>
        )}

        {/* the editor, its Send button naming the target; it closes on Ctrl+Enter */}
        {closing < 1 && (
          <div
            style={{
              position: "absolute",
              left: 470,
              top: 172,
              opacity: 1 - closing,
              transform: `scale(${1 - 0.08 * closing})`,
              transformOrigin: "50% 50%",
            }}
          >
            <Editor
              s={{
                ...EDITOR_DONE,
                active: null,
                glow: pulse > 0.5 ? "send" : null,
              }}
            />
          </div>
        )}
        <Note
          at={24}
          out={SEND}
          title="Send goes to…"
          style={{ right: 44, top: 470 }}
        >
          the window you clicked <b style={{ color: L.bronze2 }}>before</b>{" "}
          <Keys combo="Alt+S" size={26} />. The button names it:{" "}
          <span style={{ color: L.text }}>Send to Terminal</span> ↓
        </Note>
        <Note
          at={96}
          out={SEND}
          title="Wrong app?"
          style={{ left: 44, top: 300 }}
        >
          Press <Keys combo="Esc" size={26} />, click where it should go, then{" "}
          <Keys combo="Alt+S" size={26} /> again.
          <div style={{ marginTop: 10 }}>
            Or <Keys combo="Alt+C" size={26} /> to copy, and paste it anywhere.
          </div>
        </Note>

        <Chip n={3} titles={[[0, "Dispatch"]]} />
        <KeyCast presses={[{ combo: "Ctrl+Enter", at: SEND }]} />
        <Sfx at={SEND + 2} name="stamp" volume={0.55} />
        <Sfx at={TERM} name="whoosh" volume={0.3} />
        <Sfx at={CHAT} name="whoosh" volume={0.25} />
        <Captions
          items={[
            {
              from: 10,
              to: 196,
              text: "{Ctrl+Enter} sends to the window you clicked *before* {Alt+S}.",
            },
            {
              from: 204,
              to: 296,
              text: "Terminals get a *file path* for Claude Code.",
            },
            {
              from: 300,
              to: 415,
              text: "Clicked a chat box instead? The image and notes land *there*.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
