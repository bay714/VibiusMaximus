import React from "react";
import { useCurrentFrame } from "remotion";
import { along, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  KeyCast,
  L,
  Page,
  SANS,
  SceneFade,
  Sfx,
  ShieldMark,
  SlideIn,
  Tile,
  Win,
} from "../kit";
import { CAPTURE_TEXT, EDITOR_DONE, Editor, SentShot } from "../pieces";

const COPY = 12; // Alt+C: copies and closes the editor
const RIDE = [34, 78] as const; // the courier's ride to the other app
const CLICK = 96;
const PASTE = 114; // Alt+V
const CAPTURES = 222;
const DBL = [252, 258];
const REOPEN = 266;

// The courier's route (a quadratic curve) from the clipboard card to the tracker.
const P0 = { x: 560, y: 470 };
const P1 = { x: 830, y: 170 };
const P2 = { x: 1110, y: 360 };
const q = (t: number) => ({
  x: (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x,
  y: (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y,
});

const PATH: [number, number, number][] = [
  [80, 1300, 640],
  [CLICK - 4, 1240, 470],
  [CAPTURES + 6, 1000, 700],
  [DBL[0] - 4, 495, 852],
  [300, 520, 870],
];

export const S4Carry: React.FC = () => {
  const f = useCurrentFrame();
  const closing = ramp(f, COPY + 4, COPY + 18);
  const card = pop(f, COPY + 14);
  const ride = ramp(f, RIDE[0], RIDE[1]);
  const pos = along(f, PATH);
  const reopen = pop(f, REOPEN);
  const rider = q(ride);
  return (
    <SceneFade>
      <Backdrop>
        {/* what Alt+C put on the clipboard */}
        {f >= COPY + 14 && (
          <div
            style={{
              position: "absolute",
              left: 120,
              top: 250,
              opacity: card * (1 - ramp(f, CAPTURES, CAPTURES + 12)),
              transform: `scale(${0.9 + 0.1 * card})`,
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY,
                color: L.bronze2,
                fontSize: 22,
                letterSpacing: "0.18em",
                marginBottom: 12,
              }}
            >
              ON THE CLIPBOARD
            </div>
            <SentShot w={430} />
            <div
              style={{
                fontFamily: SANS,
                color: L.muted,
                fontSize: 18,
                marginTop: 10,
              }}
            >
              + the caption and numbered notes
            </div>
          </div>
        )}
        {/* the courier's route */}
        {f >= RIDE[0] && (
          <svg
            style={{ position: "absolute", inset: 0 }}
            width={1920}
            height={1080}
          >
            <path
              d={`M ${P0.x} ${P0.y} Q ${P1.x} ${P1.y} ${P2.x} ${P2.y}`}
              fill="none"
              stroke={L.bronze}
              strokeWidth={4}
              strokeDasharray="4 14"
              strokeLinecap="round"
              opacity={0.85 * (1 - ramp(f, CAPTURES, CAPTURES + 12))}
            />
          </svg>
        )}
        {f >= RIDE[0] && f < RIDE[1] + 6 && (
          <div
            style={{
              position: "absolute",
              left: rider.x - 24,
              top: rider.y - 24,
              opacity: 1 - ramp(f, RIDE[1], RIDE[1] + 6),
            }}
          >
            <ShieldMark size={48} />
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1 - 0.8 * ramp(f, REOPEN - 6, REOPEN + 6),
          }}
        >
          <SlideIn at={30} dx={60} dy={0}>
            <Win
              x={1090}
              y={190}
              w={730}
              h={520}
              title="New issue — Tracker"
              kind="light"
            >
              <div
                style={{
                  padding: "16px 24px",
                  color: "#2a2a2a",
                  fontSize: 18,
                  lineHeight: 1.45,
                  fontFamily: SANS,
                }}
              >
                <div
                  style={{ fontWeight: 700, fontSize: 24, marginBottom: 10 }}
                >
                  Landing page polish
                </div>
                <div
                  style={{
                    minHeight: 380,
                    border: `1px solid ${f >= CLICK ? "#7aa7e8" : "#ddd"}`,
                    borderRadius: 8,
                    padding: 12,
                    color: f >= PASTE + 8 ? "#2a2a2a" : "#999",
                  }}
                >
                  {f < PASTE + 8 && "Add a description…"}
                  {f >= PASTE + 8 && (
                    <div style={{ opacity: pop(f, PASTE + 8) }}>
                      <SentShot
                        w={330}
                        style={{ border: "1px solid #ddd", marginBottom: 10 }}
                      />
                    </div>
                  )}
                  {CAPTURE_TEXT.map((l, i) =>
                    f >= PASTE + 22 + i * 4 ? (
                      <div
                        key={l}
                        style={{
                          opacity: ramp(
                            f,
                            PASTE + 22 + i * 4,
                            PASTE + 28 + i * 4,
                          ),
                        }}
                      >
                        {l}
                      </div>
                    ) : null,
                  )}
                </div>
              </div>
            </Win>
          </SlideIn>
        </div>
        {/* Captures page: double-click to reopen */}
        <SlideIn at={CAPTURES} dy={60}>
          <Win
            x={100}
            y={740}
            w={1720}
            h={190}
            title="Vibius Maximus"
            kind="vibe"
          >
            <div
              style={{
                display: "flex",
                gap: 22,
                padding: "16px 22px",
                alignItems: "center",
              }}
            >
              <Tile name="captures" size={44} />
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <div
                  key={v}
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    outline:
                      v === 1 && f >= DBL[0]
                        ? `3px solid ${L.bronze2}`
                        : `1px solid ${L.line}`,
                    overflow: "hidden",
                  }}
                >
                  {v === 1 ? (
                    <SentShot w={190} style={{ borderRadius: 0 }} />
                  ) : (
                    <Page w={190} variant={v} />
                  )}
                </div>
              ))}
              <span
                style={{
                  fontFamily: DISPLAY,
                  color: L.bronze2,
                  fontSize: 22,
                  lineHeight: 1.2,
                }}
              >
                Double-click
                <br />
                to reopen
              </span>
            </div>
          </Win>
        </SlideIn>
        {/* the editor: closing on Alt+C, then reopened from Captures */}
        {closing < 1 && (
          <div
            style={{
              position: "absolute",
              left: 470,
              top: 172,
              opacity: 1 - closing,
              transform: `scale(${1 - 0.3 * closing})`,
              transformOrigin: "20% 40%",
            }}
          >
            <Editor
              s={{
                ...EDITOR_DONE,
                active: null,
                glow: f >= COPY ? "copy" : null,
              }}
            />
          </div>
        )}
        {f >= REOPEN && (
          <div
            style={{
              position: "absolute",
              left: 607,
              top: 150,
              opacity: reopen,
              transform: `scale(${0.72 * (0.85 + 0.15 * reopen)})`,
              transformOrigin: "0 0",
            }}
          >
            <Editor s={{ ...EDITOR_DONE, active: null }} />
          </div>
        )}
        {f >= 80 && <Cursor x={pos.x} y={pos.y} clicks={[CLICK, ...DBL]} />}
        <Chip n={4} titles={[[0, "The courier"]]} />
        <KeyCast
          presses={[
            { combo: "Alt+C", at: COPY },
            { combo: "Alt+V", at: PASTE },
          ]}
        />
        <Sfx at={COPY + 4} name="pop" volume={0.4} />
        <Sfx at={RIDE[0]} name="whoosh" volume={0.4} />
        <Sfx at={PASTE + 8} name="stamp" volume={0.45} />
        <Sfx at={CAPTURES} name="whoosh" volume={0.25} />
        <Sfx at={REOPEN} name="pop" volume={0.4} />
        <Captions
          items={[
            {
              from: 10,
              to: 104,
              text: "{Alt+C} copies it all: the image and the text.",
            },
            {
              from: 112,
              to: 230,
              text: "{Alt+V} delivers it to *any* app, image then text.",
            },
            {
              from: 238,
              to: 336,
              text: "Double-click any capture to *open it again*.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
