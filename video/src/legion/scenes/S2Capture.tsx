import React from "react";
import { useCurrentFrame } from "remotion";
import { along, bouncy, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  KeyCast,
  Keys,
  L,
  Num,
  Page,
  SANS,
  SceneFade,
  Sfx,
  Win,
  reveal,
} from "../kit";
import {
  CAPTION,
  CAPTION_RAMBLE,
  Editor,
  EditorState,
  NOTE_1,
  NOTE_2,
  SCRIBBLE,
} from "../pieces";

// Cue frames (scene-relative). VO: 03-freeze at 9 (click the destination, then Alt+S),
// 04a-shapes at 207, 04b-pin at 435, 04c-text at 660, 05-notes at 795, 06-cleanup at 945.
// The send target is the window in front when Alt+S is pressed, so the scene clicks the
// terminal first and the editor's button reads "Send to Terminal".
//
// Two separate tools, each with its own beat:
//  - Number shapes (on by default, Alt+N): every box, circle, arrow, line or drawing you make
//    gets the next number and a note row. Here: the rectangle round the button becomes ①.
//  - Pin (Alt+`, one-shot): arm it, click a spot, and a number drops with nothing drawn,
//    then the tool goes back to normal. Here: ② on the illustration.
//  - Text is never numbered: the hand-written note stays a plain label.
const T = {
  freeze: 101,
  dragFrom: 125,
  dragTo: 157,
  editor: 163,
  shapes: 207, // Number shapes beat
  rectFrom: 271,
  rectTo: 297,
  num1: 299,
  pin: 435, // Pin beat
  pinKey: 473,
  pinDrop: 527,
  text: 660, // Text beat
  textClick: 671,
  textFrom: 677,
  textTo: 713,
  notes: 795,
  row1Click: 799,
  dict1: [807, 833] as const,
  row2Click: 843,
  dict2: [849, 871] as const,
  capClick: 883,
  dictCap: [889, 933] as const,
  clean: 959,
  cleanDone: 985,
};
const CARDS_OUT = 785;
const TARGET_CLICK = 56; // click the terminal first: that is where Send will paste

// Editor's top-left on screen and its canvas scale (980 px for the 800 px mock page).
const EX = 470;
const EY = 172;
const K = 980 / 800;
const at = (x: number, y: number): [number, number] => [EX + x * K, EY + y * K];

const PATH: [number, number, number][] = [
  [20, 900, 620],
  [TARGET_CLICK - 4, 1640, 262],
  [84, 1560, 420],
  [T.dragFrom, EX, EY],
  [T.dragTo, EX + 980, EY + 563],
  [185, 1100, 700],
  [T.rectFrom - 6, ...at(42, 290)],
  [T.rectTo, ...at(222, 364)],
  [T.pinKey, 1150, 640],
  [T.pinDrop - 4, ...at(731, 97)],
  [T.textClick - 4, ...at(150, 380)],
  [T.textTo + 6, ...at(150, 380)],
  [T.row1Click - 4, 760, 813],
  [T.row2Click - 4, 760, 866],
  [T.capClick - 4, 760, 761],
  [955, 820, 761],
  [1055, 960, 700],
];

function editorState(f: number): EditorState {
  const dictated = (range: readonly [number, number], text: string) =>
    f >= range[1] + 4 ? text : "";
  const pinArmed = f >= T.pinKey + 2 && f < T.pinDrop;
  return {
    rect: ramp(f, T.rectFrom, T.rectTo),
    num1: f >= T.num1 ? bouncy(f, T.num1) : 0,
    num2: f >= T.pinDrop ? bouncy(f, T.pinDrop) : 0,
    scribble: f >= T.textClick ? reveal(SCRIBBLE, f, T.textFrom, T.textTo) : "",
    tool:
      f >= T.textClick && f < T.textTo + 6
        ? "text"
        : pinArmed
          ? "pin"
          : "select",
    notes: [
      f >= T.num1 + 2 ? dictated(T.dict1, NOTE_1) : null,
      f >= T.pinDrop + 2 ? dictated(T.dict2, NOTE_2) : null,
    ],
    caption:
      f >= T.cleanDone ? CAPTION : f >= T.dictCap[1] + 4 ? CAPTION_RAMBLE : "",
    listening:
      f >= T.dict1[0] && f < T.dict1[1] + 4
        ? 1
        : f >= T.dict2[0] && f < T.dict2[1] + 4
          ? 2
          : f >= T.dictCap[0] && f < T.dictCap[1] + 4
            ? "caption"
            : null,
    active:
      f >= T.num1 + 2 && f < T.pinDrop
        ? 1
        : f >= T.pinDrop + 2 && f < T.text
          ? 2
          : f >= T.row1Click && f < T.row2Click
            ? 1
            : f >= T.row2Click && f < T.capClick
              ? 2
              : null,
    cleaning: ramp(f, T.clean + 4, T.cleanDone + 4),
    target: "Terminal",
    spotlight:
      f >= T.shapes && f < T.rectFrom + 10
        ? "shapes"
        : f >= T.pin && f < T.pinDrop + 10
          ? "pin"
          : null,
  };
}

/** A side card explaining one tool (video graphic, not app UI). */
const ToolCard: React.FC<{
  at: number;
  side: "left" | "right";
  mark: React.ReactNode;
  title: string;
  lines: string[];
  combo: string;
  foot: string;
  lit: boolean;
}> = ({ at, side, mark, title, lines, combo, foot, lit }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const p = pop(f, at);
  const o = Math.min(1, p * 1.4) * (1 - ramp(f, CARDS_OUT, CARDS_OUT + 12));
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 300,
        [side]: 44,
        width: 390,
        padding: "26px 26px 22px",
        borderRadius: 18,
        background: L.card,
        border: `1px solid ${lit ? L.bronze2 : L.line}`,
        boxShadow: `0 24px 60px #000b${lit ? `, 0 0 30px ${L.bronze}44` : ""}`,
        opacity: o,
        transform: `translateX(${(1 - p) * (side === "left" ? -40 : 40)}px)`,
        fontFamily: SANS,
        color: L.text,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {mark}
        <span style={{ fontFamily: DISPLAY, fontSize: 36 }}>{title}</span>
      </div>
      {lines.map((l) => (
        <div
          key={l}
          style={{ fontSize: 21, lineHeight: 1.4, color: "#d9ccb9" }}
        >
          {l}
        </div>
      ))}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 4,
          fontSize: 17,
          color: L.bronze2,
        }}
      >
        <Keys combo={combo} size={30} />
        {foot}
      </div>
    </div>
  );
};

/** "no number" tag next to the hand-written label. */
const PlainTag: React.FC = () => {
  const f = useCurrentFrame();
  const a = T.textTo + 6;
  if (f < a || f > CARDS_OUT + 12) return null;
  const p = pop(f, a) * (1 - ramp(f, CARDS_OUT, CARDS_OUT + 12));
  const [x, y] = at(150, 410);
  return (
    <div
      style={{
        position: "absolute",
        left: x + 20,
        top: y + 4,
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
        fontFamily: SANS,
        fontSize: 18,
        fontWeight: 600,
        color: "#fff",
        background: L.red,
        border: `1px solid ${L.bronze2}`,
        borderRadius: 8,
        padding: "4px 10px",
        zIndex: 45,
      }}
    >
      Text: no number
    </div>
  );
};

/** Windows Terminal running Claude Code: clicked first, so it becomes the send target. */
const TerminalTarget: React.FC = () => {
  const f = useCurrentFrame();
  const focused = f >= TARGET_CLICK;
  const tag = pop(f, TARGET_CLICK + 2) * (1 - ramp(f, T.editor - 10, T.editor));
  return (
    <>
      <Win
        x={1470}
        y={EY - 42}
        w={410}
        h={620}
        title="Windows Terminal — claude"
        kind="terminal"
        style={{
          border: `1px solid ${focused ? L.bronze2 : "#3b3b3e"}`,
          boxShadow: focused
            ? `0 30px 80px #000a, 0 0 0 2px ${L.bronze2}`
            : undefined,
        }}
      >
        <div
          style={{
            fontFamily: '"Cascadia Mono", Consolas, monospace',
            fontSize: 15,
            lineHeight: 1.6,
            color: "#bdbdc2",
            padding: "14px 16px",
          }}
        >
          <div>PS C:\code\acme&gt; claude</div>
          <div style={{ color: "#8a8a8a", margin: "10px 0" }}>
            ✻ Welcome to Claude Code
          </div>
          <div
            style={{
              border: `1px solid ${focused ? "#d4a15799" : "#444"}`,
              borderRadius: 8,
              padding: "8px 10px",
              color: "#e6e6e6",
            }}
          >
            {">"}{" "}
            {focused && (
              <span
                style={{
                  display: "inline-block",
                  width: 9,
                  height: 18,
                  background: "#e6e6e6",
                  verticalAlign: "middle",
                }}
              />
            )}
          </div>
        </div>
      </Win>
      {f >= TARGET_CLICK + 2 && f < T.editor && (
        <div
          style={{
            position: "absolute",
            left: 1470,
            width: 410,
            top: EY + 600,
            textAlign: "center",
            fontFamily: DISPLAY,
            fontSize: 26,
            color: L.bronze2,
            opacity: tag,
            transform: `translateY(${(1 - tag) * 12}px)`,
          }}
        >
          ↑ Clicked: Send will paste here
        </div>
      )}
    </>
  );
};

export const S2Capture: React.FC = () => {
  const f = useCurrentFrame();
  const pos = along(f, PATH);
  const selecting = f >= T.dragFrom && f < T.editor;
  const dim = ramp(f, T.freeze, T.freeze + 10);
  const ed = pop(f, T.editor);
  const selW = Math.max(0, pos.x - EX);
  const selH = Math.max(0, pos.y - EY);
  const crosshair = f < T.editor || (f >= T.pinKey + 2 && f < T.pinDrop);
  return (
    <SceneFade>
      <Backdrop>
        {/* the app being changed on the left (its page sits exactly where the selection, and
            then the editor, will be) and the destination on the right */}
        <Win
          x={120}
          y={EY - 42}
          w={1330}
          h={780}
          title="acme — Google Chrome"
          kind="light"
          style={{ filter: `saturate(${1 - 0.4 * dim})` }}
        >
          <div
            style={{ position: "absolute", inset: 0, background: "#fbfaf8" }}
          >
            <div style={{ position: "absolute", left: EX - 120, top: 0 }}>
              <Page w={980} />
            </div>
          </div>
        </Win>
        <TerminalTarget />
        {!selecting && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(18,12,9,${0.6 * dim})`,
            }}
          />
        )}
        {selecting && (
          <div
            style={{
              position: "absolute",
              left: EX,
              top: EY,
              width: selW,
              height: selH,
              outline: `2px solid ${L.bronze}`,
              boxShadow: "0 0 0 9999px rgba(18,12,9,0.65)",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -26,
                left: 0,
                background: L.red,
                color: "#fff",
                font: `600 13px ${SANS}`,
                padding: "4px 7px",
                borderRadius: 4,
                whiteSpace: "nowrap",
              }}
            >
              {Math.round(selW * 1.25)} × {Math.round(selH * 1.25)}
            </span>
          </div>
        )}
        {f >= T.freeze + 6 && f < T.editor && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: 150,
              transform: "translateX(-50%)",
              background: "rgba(27,21,18,0.92)",
              color: L.text,
              padding: "10px 18px",
              borderRadius: 999,
              fontFamily: SANS,
              fontSize: 17,
              border: "1px solid rgba(255,255,255,0.13)",
              opacity:
                ramp(f, T.freeze + 6, T.freeze + 14) *
                (1 - ramp(f, T.editor - 6, T.editor)),
            }}
          >
            Drag to select · Ctrl+A for the whole screen · Esc to cancel
          </div>
        )}
        {f >= T.editor && (
          <div
            style={{
              position: "absolute",
              left: EX,
              top: EY,
              opacity: ed,
              transform: `scale(${0.96 + 0.04 * ed})`,
              transformOrigin: "50% 40%",
            }}
          >
            <Editor s={editorState(f)} />
          </div>
        )}

        <ToolCard
          at={T.shapes + 4}
          side="left"
          mark={
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: L.red,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              #
            </span>
          }
          title="Number shapes"
          lines={[
            "Draw a box, circle, arrow or line.",
            "It gets the next number, and its own note.",
          ]}
          combo="Alt+N"
          foot="On by default"
          lit={f >= T.shapes && f < T.pin}
        />
        <ToolCard
          at={T.pin + 4}
          side="right"
          mark={<Num n={2} size={46} />}
          title="Pin"
          lines={[
            "Click a spot. A number drops there, with nothing drawn.",
            "It gets its own note too.",
          ]}
          combo="Alt+`"
          foot="One click, then off"
          lit={f >= T.pin && f < T.text}
        />
        <PlainTag />

        {f >= 20 && (
          <Cursor
            x={pos.x}
            y={pos.y}
            kind={crosshair ? "cross" : "arrow"}
            clicks={[
              TARGET_CLICK,
              T.pinDrop,
              T.textClick,
              T.row1Click,
              T.row2Click,
              T.capClick,
            ]}
          />
        )}

        <Chip n={2} titles={[[0, "Mark the target"]]} />
        <KeyCast
          presses={[
            { combo: "Alt+S", at: 93 },
            { combo: "Alt+`", at: T.pinKey },
            {
              combo: "Ctrl+Space",
              at: T.dict1[0],
              hold: T.dict1[1] - T.dict1[0],
            },
            {
              combo: "Ctrl+Space",
              at: T.dict2[0],
              hold: T.dict2[1] - T.dict2[0],
            },
            {
              combo: "Ctrl+Space",
              at: T.dictCap[0],
              hold: T.dictCap[1] - T.dictCap[0],
            },
            { combo: "Alt+D", at: T.clean },
          ]}
        />
        <Sfx at={T.freeze} name="sword" volume={0.5} />
        <Sfx at={T.freeze + 2} name="shutter" volume={0.35} />
        <Sfx at={T.editor} name="whoosh" volume={0.3} />
        <Sfx at={T.num1} name="pop" volume={0.45} />
        <Sfx at={T.pinDrop} name="shield" volume={0.5} />
        {[T.dict1[1] + 4, T.dict2[1] + 4, T.dictCap[1] + 4].map((a) => (
          <Sfx key={a} at={a} name="pop" volume={0.3} />
        ))}
        <Sfx at={T.clean + 6} name="sparkle" volume={0.4} />
        <Captions
          items={[
            {
              from: 10,
              to: 86,
              text: "First, *click* the window it should go to.",
            },
            {
              from: 93,
              to: 201,
              text: "{Alt+S} freezes the screen. Drag over what to change.",
            },
            {
              from: 207,
              to: 429,
              text: "*Number shapes*, on by default: every shape you draw gets a number.",
            },
            {
              from: 435,
              to: 653,
              text: "*Pin* {Alt+`}: click a spot, get a number. Nothing drawn.",
            },
            {
              from: 660,
              to: 789,
              text: "Text on the shot is just a label, *no number*.",
            },
            {
              from: 795,
              to: 939,
              text: "Say a note for each. Hold {Ctrl+Space} to dictate.",
            },
            {
              from: 945,
              to: 1055,
              text: "Rambled? {Alt+D} tidies the wording.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
