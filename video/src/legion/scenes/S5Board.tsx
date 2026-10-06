import React from "react";
import { useCurrentFrame } from "remotion";
import { along, bouncy, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  ExcaliBar,
  KeyCast,
  Keys,
  L,
  MONO,
  Page,
  SANS,
  SceneFade,
  Sfx,
  Win,
  reveal,
} from "../kit";
import {
  Composer,
  BOARD_INTRO,
  BOARD_LABELS,
  BOARD_NAME,
  BOARD_NOTES,
  BOARD_OUTRO,
  BoardBar,
  BoardShot,
  Btn,
  Bubble,
  HandText,
  NoteRow,
  PinTools,
  ShotMarks,
} from "../pieces";

// Cue frames. VO: 12-board at 9, 13a-board-capture at 120, 13-board-build at 360,
// 14-board-send at 540, 15-boards at 702.
// The board sends to the window in front when Alt+B was pressed, so the scene clicks the chat
// box first. Captures go to the board with Alt+Enter ("Add to board") instead of being sent.
const DEST_CLICK = 30; // click the chat box: the board will send here
const OPEN = 60; // Alt+B
const DOCK = [112, 130] as const; // the board tucks into the corner while we capture
const SHOTS = [140, 210, 280]; // each: Alt+S, select, then Alt+Enter at +40
const UNDOCK = [352, 372] as const;
const IMG = SHOTS.map((s) => s + 54); // each capture lands on the board
const INTRO = [380, 404] as const;
const OUTRO = [406, 430] as const;
const BUSY = [432, 444] as const;
const PIN = 448;
const CIRCLE = [456, 472] as const;
const BOX = [480, 492] as const;
const SEND = 540;
const PASTE = [560, 568, 576];
const LINES = 588;
const BOARDS = 702;
const PAGE_VARIANTS = [0, 2, 4]; // the three screens captured (match the board images)

// Board window and canvas origin on screen.
const WX = 110;
const WY = 170;
const CX = WX;
const CY = WY + 42;
const img = (i: number) => ({ x: CX + 60 + i * 540, y: CY + 128 });

const PATH: [number, number, number][] = [
  [UNDOCK[1], 960, 640],
  [PIN - 4, img(0).x + 201, img(0).y + 55],
  [CIRCLE[0], img(1).x + 230, img(1).y + 37],
  [CIRCLE[1], img(1).x + 406, img(1).y + 221],
  [BOX[0], img(2).x + 20, img(2).y + 150],
  [BOX[1], img(2).x + 120, img(2).y + 194],
  [SEND - 6, WX + 1610, WY + 735],
];

function marks(f: number): ShotMarks {
  return {
    pin: f >= PIN ? bouncy(f, PIN) : 0,
    busy: f >= BUSY[0] ? reveal("↑ too busy", f, BUSY[0], BUSY[1]) : "",
    circle: ramp(f, CIRCLE[0], CIRCLE[1]),
    num2: f >= CIRCLE[1] + 2 ? bouncy(f, CIRCLE[1] + 2) : 0,
    box: ramp(f, BOX[0], BOX[1]),
    num3: f >= BOX[1] + 2 ? bouncy(f, BOX[1] + 2) : 0,
  };
}

const NOTE_AT = [PIN + 2, CIRCLE[1] + 4, BOX[1] + 4];

const Canvas: React.FC<{ f: number; height: number }> = ({ f, height }) => {
  const m = marks(f);
  return (
    <div
      style={{
        position: "relative",
        height,
        background: "#fff",
        overflow: "hidden",
      }}
    >
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
        <ExcaliBar />
      </div>
      <div style={{ position: "absolute", top: 12, right: 14 }}>
        <PinTools />
      </div>
      {f < IMG[0] && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            fontFamily: SANS,
            fontSize: 20,
            color: "#9a9aa0",
          }}
        >
          Drop or paste images, add text boxes and pins, then send.
        </div>
      )}
      {f >= INTRO[0] && (
        <HandText style={{ left: 60, top: 70 }}>
          {reveal(BOARD_INTRO, f, INTRO[0], INTRO[1])}
        </HandText>
      )}
      {BOARD_LABELS.map((label, i) => {
        if (f < IMG[i]) return null;
        const p = bouncy(f, IMG[i]);
        return (
          <div
            key={label}
            style={{
              position: "absolute",
              left: 60 + i * 540,
              top: 128 - (1 - p) * 60,
              opacity: Math.min(1, p * 1.4),
            }}
          >
            <div
              style={{
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 0 0 1px #ddd, 0 6px 20px #0002",
              }}
            >
              <BoardShot i={i} w={420} m={m} />
            </div>
            <HandText
              style={{
                position: "static",
                fontSize: 18,
                color: "#6b6b70",
                marginTop: 4,
              }}
            >
              {label}
            </HandText>
            {i < 2 && (
              <div
                style={{
                  position: "absolute",
                  left: 440,
                  top: 100,
                  fontSize: 40,
                  color: "#b5b5ba",
                }}
              >
                →
              </div>
            )}
          </div>
        );
      })}
      {f >= OUTRO[0] && (
        <HandText style={{ left: 60, top: 418 }}>
          {reveal(BOARD_OUTRO, f, OUTRO[0], OUTRO[1])}
        </HandText>
      )}
    </div>
  );
};

/** The chat box clicked before Alt+B: the board sends here. */
const Destination: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= OPEN + 20) return null;
  const o = 1 - ramp(f, OPEN + 4, OPEN + 18);
  const focused = f >= DEST_CLICK;
  const pos = along(f, [
    [0, 1300, 420],
    [DEST_CLICK - 4, 900, 735],
    [OPEN, 960, 720],
  ]);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Win x={330} y={180} w={1260} h={640} title="Chat — Google Chrome">
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <Composer text="" caret={focused} flash={focused ? 0.6 : 0} />
        </div>
      </Win>
      {focused && (
        <div
          style={{
            position: "absolute",
            left: 390,
            top: 620,
            fontFamily: DISPLAY,
            fontSize: 28,
            color: L.bronze2,
            opacity: pop(f, DEST_CLICK + 2),
          }}
        >
          Clicked: the board will send here ↓
        </div>
      )}
      <Cursor x={pos.x} y={pos.y} clicks={[DEST_CLICK]} />
    </div>
  );
};

/** Alt+S, select, then Alt+Enter sends each capture to the docked board instead of an app. */
const Montage: React.FC = () => {
  const f = useCurrentFrame();
  if (f < DOCK[0] - 4 || f >= UNDOCK[1]) return null;
  const o =
    ramp(f, DOCK[0] - 4, DOCK[0] + 8) * (1 - ramp(f, UNDOCK[0], UNDOCK[1]));
  const k = Math.max(0, SHOTS.filter((s) => f >= s - 12).length - 1);
  const s0 = SHOTS[k];
  const sel = ramp(f, s0 + 6, s0 + 20);
  const card = f >= s0 + 22 && f < s0 + 56;
  const fly = ramp(f, s0 + 42, s0 + 56);
  // the card sits at (300, 300), 520 wide; it flies to board slot k (board docked at 0.42)
  const slot = { x: 170 + 540 * k, y: 340 };
  const tx = slot.x * 0.42 + 1063.8;
  const ty = slot.y * 0.42 + 138.6;
  const cx = 300 + (tx - 300) * fly;
  const cy = 300 + (ty - 300) * fly;
  const cs = 1 - (1 - 176 / 520) * fly;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Win
        x={90}
        y={200}
        w={960}
        h={600}
        title="acme — Google Chrome"
        kind="light"
      >
        <Page w={958} variant={PAGE_VARIANTS[k]} />
      </Win>
      {f >= s0 && f < s0 + 42 && (
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 242,
            width: 960,
            height: 558,
            background: `rgba(18,12,9,${0.5 * ramp(f, s0, s0 + 6)})`,
          }}
        />
      )}
      {f >= s0 + 6 && f < s0 + 24 && (
        <div
          style={{
            position: "absolute",
            left: 92,
            top: 244,
            width: 956 * sel,
            height: 550 * sel,
            outline: `2px solid ${L.bronze}`,
          }}
        />
      )}
      {card && (
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            width: 520,
            transform: `scale(${cs})`,
            transformOrigin: "0 0",
            opacity: Math.min(1, pop(f, s0 + 22) * 1.4),
            borderRadius: 12,
            overflow: "hidden",
            border: `1px solid ${L.line}`,
            boxShadow: "0 24px 60px #000c",
            background: L.card,
          }}
        >
          <Page w={520} variant={PAGE_VARIANTS[k]} />
          {fly === 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                padding: "8px 10px",
                background: "#150f0c",
                borderTop: `1px solid ${L.line}`,
              }}
            >
              <Btn size={14} glow={f >= s0 + 36 ? 1 : 0}>
                Add to board <Keys combo="Alt+Enter" size={15} />
              </Btn>
              <Btn primary size={14}>
                Send to Chrome <Keys combo="Ctrl+Enter" size={15} />
              </Btn>
            </div>
          )}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 1110,
          top: 560,
          width: 714,
          textAlign: "center",
          fontFamily: DISPLAY,
          fontSize: 26,
          color: L.bronze2,
          opacity: ramp(f, DOCK[1], DOCK[1] + 10),
        }}
      >
        ↑ The board: {Math.min(3, SHOTS.filter((s) => f >= s + 54).length)} of 3
        captures
      </div>
    </div>
  );
};

const SAVED = [
  { name: BOARD_NAME, meta: "3 images · Oct 5", variant: 2, current: true },
  { name: "Onboarding flow", meta: "5 images · Oct 3", variant: 1 },
  { name: "Landing polish", meta: "2 images · Oct 1", variant: 5 },
];

export const S5Board: React.FC = () => {
  const f = useCurrentFrame();
  const win = pop(f, OPEN + 6);
  const boardOut = ramp(f, SEND + 4, SEND + 16);
  const chatIn = pop(f, SEND + 10);
  const chatOut = ramp(f, BOARDS - 8, BOARDS + 2);
  const boardBack = pop(f, BOARDS);
  const panel = pop(f, BOARDS + 8);
  const pos = along(f, PATH);
  const showBoard = (f >= OPEN && f < SEND + 16) || f >= BOARDS;
  const dock = ramp(f, DOCK[0], DOCK[1]) * (1 - ramp(f, UNDOCK[0], UNDOCK[1]));
  return (
    <SceneFade>
      <Backdrop>
        <Destination />
        <Montage />
        {showBoard && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: f < BOARDS ? win * (1 - boardOut) : boardBack,
              transform:
                f < BOARDS && dock > 0
                  ? `translate(${1063.8 * dock}px, ${138.6 * dock}px) scale(${1 - 0.58 * dock})`
                  : `scale(${f < BOARDS ? 0.96 + 0.04 * win : 0.97 + 0.03 * boardBack})`,
              transformOrigin: "0 0",
            }}
          >
            <Win
              x={WX}
              y={WY}
              w={1700}
              h={760}
              title="Vibius Maximus Board"
              kind="vibe"
            >
              {f < BOARDS ? (
                <>
                  <Canvas f={f} height={478} />
                  {BOARD_NOTES.map((t, i) =>
                    f >= NOTE_AT[i] ? (
                      <NoteRow
                        key={t}
                        n={i + 1}
                        text={reveal(t, f, NOTE_AT[i] + 2, NOTE_AT[i] + 14)}
                        active={i === 2 && f >= NOTE_AT[2]}
                      />
                    ) : null,
                  )}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <BoardBar glow={f >= SEND ? "send" : null} />
                  </div>
                </>
              ) : (
                <>
                  <div
                    style={{
                      position: "relative",
                      height: 670,
                      background: "#fff",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "#0007",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: 150,
                        right: 150,
                        top: 50,
                        background: L.card,
                        border: `1px solid ${L.line}`,
                        borderRadius: 14,
                        padding: "22px 26px",
                        boxShadow: "0 30px 80px #000a",
                        opacity: panel,
                        transform: `translateY(${(1 - panel) * 40}px)`,
                        fontFamily: SANS,
                        color: L.text,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          marginBottom: 20,
                        }}
                      >
                        <span
                          style={{ fontFamily: DISPLAY, fontSize: 32, flex: 1 }}
                        >
                          Boards
                        </span>
                        <Btn primary size={16}>
                          + New board
                        </Btn>
                        <span
                          style={{
                            color: L.muted,
                            fontSize: 26,
                            marginLeft: 8,
                          }}
                        >
                          ×
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 24 }}>
                        {SAVED.map((b, i) => {
                          const c = pop(f, BOARDS + 14 + i * 6);
                          return (
                            <div
                              key={b.name}
                              style={{
                                flex: 1,
                                border: `1px solid ${b.current ? L.bronze2 : L.line}`,
                                borderRadius: 12,
                                overflow: "hidden",
                                background: L.card2,
                                opacity: c,
                                transform: `translateY(${(1 - c) * 20}px)`,
                              }}
                            >
                              <Page w={420} variant={b.variant} />
                              <div style={{ padding: "14px 16px" }}>
                                <div style={{ fontSize: 21, fontWeight: 600 }}>
                                  {b.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 16,
                                    color: L.muted,
                                    margin: "4px 0 12px",
                                  }}
                                >
                                  {b.meta}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                  {b.current ? (
                                    <span
                                      style={{ color: L.bronze2, fontSize: 16 }}
                                    >
                                      Open now
                                    </span>
                                  ) : (
                                    <>
                                      <Btn size={14}>Open</Btn>
                                      <Btn size={14}>Delete</Btn>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  >
                    <BoardBar glow="menu" />
                  </div>
                </>
              )}
            </Win>
          </div>
        )}

        {/* what arrives in the chat */}
        {f >= SEND + 10 && f < BOARDS + 2 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: chatIn * (1 - chatOut),
              transform: `translateY(${(1 - chatIn) * 40}px)`,
            }}
          >
            <Win x={330} y={170} w={1260} h={760} title="Chat — Google Chrome">
              <Bubble me w={1000} size={20}>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 14,
                    minHeight: 172,
                  }}
                >
                  {[0, 1, 2].map((i) => {
                    if (f < PASTE[i]) return null;
                    const p = bouncy(f, PASTE[i]);
                    return (
                      <div
                        key={i}
                        style={{
                          position: "relative",
                          borderRadius: 8,
                          overflow: "hidden",
                          transform: `scale(${0.7 + 0.3 * p})`,
                          opacity: Math.min(1, p * 1.5),
                        }}
                      >
                        <BoardShot i={i} w={300} />
                        <span
                          style={{
                            position: "absolute",
                            right: 8,
                            bottom: 8,
                            background: "#000b",
                            color: "#fff",
                            fontSize: 14,
                            padding: "3px 8px",
                            borderRadius: 6,
                          }}
                        >
                          Image {i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontFamily: MONO,
                    fontSize: 18,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    minHeight: 280,
                  }}
                >
                  {[
                    "3 images attached, in the order marked below.",
                    BOARD_INTRO,
                    "[Image 1]",
                    "[Image 2]",
                    "[Image 3]",
                    BOARD_OUTRO,
                    ...BOARD_NOTES.map((t, i) => `${i + 1}. ${t}`),
                  ].map((line, i) =>
                    f >= LINES + i * 5 ? (
                      <div
                        key={line}
                        style={{
                          color: line.startsWith("[") ? L.bronze2 : "#ececec",
                          opacity: ramp(f, LINES + i * 5, LINES + i * 5 + 6),
                        }}
                      >
                        {line}
                      </div>
                    ) : null,
                  )}
                </div>
              </Bubble>
            </Win>
          </div>
        )}

        {f >= UNDOCK[1] && f < SEND + 6 && (
          <Cursor x={pos.x} y={pos.y} clicks={[PIN, SEND - 2]} />
        )}

        <Chip
          n={5}
          titles={[
            [0, "The campaign"],
            [SEND, "Sent in formation"],
            [BOARDS, "Every campaign kept"],
          ]}
        />
        <KeyCast
          presses={[
            { combo: "Alt+B", at: OPEN },
            ...SHOTS.flatMap((s) => [
              { combo: "Alt+S", at: s },
              { combo: "Alt+Enter", at: s + 40 },
            ]),
            { combo: "Ctrl+Enter", at: SEND },
          ]}
        />
        <Sfx at={DEST_CLICK} name="click" volume={0.35} />
        <Sfx at={OPEN + 6} name="whoosh" volume={0.35} />
        {SHOTS.map((a) => (
          <Sfx key={`s${a}`} at={a + 4} name="shutter" volume={0.25} />
        ))}
        {SHOTS.map((a) => (
          <Sfx key={`w${a}`} at={a + 42} name="whoosh" volume={0.22} />
        ))}
        {IMG.map((a) => (
          <Sfx key={a} at={a} name="drop" volume={0.4} />
        ))}
        <Sfx at={PIN} name="shield" volume={0.45} />
        <Sfx at={CIRCLE[1] + 2} name="pop" volume={0.4} />
        <Sfx at={BOX[1] + 2} name="pop" volume={0.4} />
        <Sfx at={SEND + 2} name="stamp" volume={0.55} />
        {PASTE.map((a) => (
          <Sfx key={a} at={a} name="pop" volume={0.3} />
        ))}
        <Sfx at={BOARDS + 8} name="scroll" volume={0.45} />
        <Captions
          items={[
            {
              from: 8,
              to: 112,
              text: "Click your destination, then {Alt+B} opens the board.",
            },
            {
              from: 120,
              to: 350,
              text: "Each {Alt+S} capture? {Alt+Enter} adds it to the *board*.",
            },
            {
              from: 358,
              to: 534,
              text: "Screenshots, *notes* and pins, read in order.",
            },
            {
              from: 540,
              to: 692,
              text: "{Ctrl+Enter} sends every image, *labelled* to match.",
            },
            { from: BOARDS, to: 788, text: "Every campaign is *kept*." },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
