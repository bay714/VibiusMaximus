import React from "react";
import { useCurrentFrame } from "remotion";
import { along, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  Drift,
  KeyCast,
  L,
  SANS,
  SceneFade,
  Sfx,
  SlideIn,
  Win,
} from "../kit";
import { Bubble, Composer } from "../pieces";

// Dictation types wherever your text cursor is, so you click the destination first.
// Settings → General → Shortcut Behavior: Auto (default: hold to record, or tap to toggle),
// Hold, or Toggle.
// VO: "02a-click" at 12, "02-dictate" at 96, "02b-modes" at 330.
const CLICK = 58; // click into the chat box: that's where the words will go
const HOLD = 100; // Ctrl+Space down
const RELEASE = 228; // up: the text lands all at once, at the cursor
const MODES = 336; // the Shortcut Behavior card
const TAP_ON = 372; // tap once: recording starts and keeps going
const TAP_OFF = 456; // tap again: it stops and the text lands
const TEXT =
  "Put it under Appearance, follow the system by default, and remember the choice.";
const TEXT2 = " Add a keyboard shortcut for it too.";

// The chat box on screen (the window is at 330,180, 1260×640; the composer sits at its foot).
const BOX = { x: 370, y: 690, w: 1180, h: 96 };

/** Handy's recording overlay at the bottom of the screen, bars moving while it listens. */
const Overlay: React.FC = () => {
  const f = useCurrentFrame();
  const session = [
    [HOLD, RELEASE],
    [TAP_ON, TAP_OFF],
  ].find(([a, b]) => f >= a && f < b + 10);
  if (!session) return null;
  const [a, b] = session;
  const inn = pop(f, a + 2);
  const out = ramp(f, b, b + 8);
  return (
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
        opacity: inn * (1 - out),
        transform: `scale(${0.8 + 0.2 * inn - 0.2 * out})`,
        zIndex: 45,
      }}
    >
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          background: L.red2,
          marginRight: 12,
          boxShadow: `0 0 10px ${L.red2}`,
        }}
      />
      {Array.from({ length: 13 }, (_, i) => {
        const h =
          10 +
          30 * Math.abs(Math.sin(f * 0.35 + i * 1.7) * Math.sin(f * 0.13 + i));
        return (
          <span
            key={i}
            style={{
              width: 6,
              height: h,
              borderRadius: 3,
              background: L.bronze2,
            }}
          />
        );
      })}
    </div>
  );
};

/** "Your words land here": a video pointer at the clicked chat box (not app UI). */
const HereTag: React.FC = () => {
  const f = useCurrentFrame();
  if (f < CLICK + 2) return null;
  const p = pop(f, CLICK + 2) * (1 - ramp(f, RELEASE + 40, RELEASE + 52));
  return (
    <div
      style={{
        position: "absolute",
        left: BOX.x + 20,
        top: BOX.y - 66,
        opacity: p,
        transform: `translateY(${(1 - p) * 12}px)`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: DISPLAY,
        fontSize: 28,
        color: L.bronze2,
        zIndex: 40,
      }}
    >
      Your words land here, at the cursor
      <span style={{ fontSize: 30 }}>↓</span>
    </div>
  );
};

// Settings → General → Shortcut Behavior (src/components/settings/ShortcutActivation.tsx).
const BEHAVIOURS = [
  ["Auto", "Hold to record or tap to toggle"],
  ["Hold", "Records while you hold the shortcut"],
  ["Toggle", "Tap the shortcut to start recording, tap again to stop"],
] as const;

/** The Shortcut Behavior setting, Auto selected (the default). */
const ModesCard: React.FC = () => {
  const f = useCurrentFrame();
  if (f < MODES) return null;
  const p = pop(f, MODES);
  return (
    <div
      style={{
        position: "absolute",
        left: 480,
        top: 250,
        width: 960,
        padding: "26px 30px 28px",
        borderRadius: 16,
        background: L.card,
        border: `1px solid ${L.bronze2}`,
        boxShadow: `0 30px 80px #000c, 0 0 30px ${L.bronze}33`,
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 30}px)`,
        fontFamily: SANS,
        color: L.text,
        zIndex: 30,
      }}
    >
      <div style={{ fontSize: 15, color: L.muted, letterSpacing: "0.04em" }}>
        Settings › General
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, marginTop: 6 }}>
        Shortcut Behavior
      </div>
      <div style={{ fontSize: 17, color: L.muted, marginTop: 4 }}>
        Choose how the transcribe shortcut starts and stops recording.
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
        {BEHAVIOURS.map(([name, desc], i) => {
          const on = i === 0;
          return (
            <div
              key={name}
              style={{
                flex: 1,
                borderRadius: 12,
                padding: "16px 18px",
                border: `1px solid ${on ? L.bronze2 : L.line}`,
                background: on ? `${L.bronze2}1f` : L.card2,
                opacity: ramp(f, MODES + 8 + i * 6, MODES + 16 + i * 6),
              }}
            >
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 600,
                  color: on ? L.bronze2 : L.text,
                }}
              >
                {name}
                {on && (
                  <span
                    style={{
                      fontSize: 14,
                      color: L.muted,
                      fontWeight: 400,
                      marginLeft: 10,
                    }}
                  >
                    default
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 17,
                  color: "#d9ccb9",
                  marginTop: 6,
                  lineHeight: 1.4,
                }}
              >
                {desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const S1Dictate: React.FC = () => {
  const f = useCurrentFrame();
  const focused = f >= CLICK;
  const landed = f >= RELEASE + 6;
  const landed2 = f >= TAP_OFF + 6;
  const pos = along(f, [
    [18, 1350, 420],
    [CLICK - 4, BOX.x + 360, BOX.y + 40],
    [HOLD, BOX.x + 380, BOX.y + 48],
    [RELEASE + 60, BOX.x + 1040, BOX.y + 150],
  ]);
  const flash = landed2
    ? Math.max(0.35, 1 - ramp(f, TAP_OFF + 6, TAP_OFF + 40))
    : landed
      ? Math.max(0.35, 1 - ramp(f, RELEASE + 6, RELEASE + 40))
      : focused
        ? 0.35 + 0.4 * (1 - ramp(f, CLICK, CLICK + 20))
        : 0;
  return (
    <SceneFade>
      <Backdrop>
        <Drift>
          <SlideIn at={0} dy={50}>
            <Win x={330} y={180} w={1260} h={640} title="Chat — Google Chrome">
              <Bubble me>The settings page needs a dark mode.</Bubble>
              <Bubble>
                Sure — where should the toggle live, and should it follow the
                system setting by default?
              </Bubble>
              <div
                style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
              >
                <Composer
                  text={(landed ? TEXT : "") + (landed2 ? TEXT2 : "")}
                  caret={focused}
                  flash={flash}
                />
              </div>
            </Win>
          </SlideIn>
          <HereTag />
          <Overlay />
          {f >= 18 && f < MODES && (
            <Cursor x={pos.x} y={pos.y} clicks={[CLICK]} />
          )}
        </Drift>
        <ModesCard />
        <Chip n={1} titles={[[0, "Give the order"]]} />
        <KeyCast
          presses={[
            { combo: "Ctrl+Space", at: HOLD, hold: RELEASE - HOLD },
            { combo: "Ctrl+Space", at: TAP_ON, hold: 5 },
            { combo: "Ctrl+Space", at: TAP_OFF, hold: 5 },
          ]}
        />
        <Sfx at={CLICK} name="click" volume={0.35} />
        <Sfx at={RELEASE + 6} name="pop" volume={0.45} />
        <Sfx at={TAP_OFF + 6} name="pop" volume={0.45} />
        <Captions
          items={[
            {
              from: 10,
              to: 90,
              text: "First, *click* where the words should go.",
            },
            {
              from: 96,
              to: 324,
              text: "Hold {Ctrl+Space}, speak, let go: it lands *at your cursor*.",
            },
            {
              from: 330,
              to: 535,
              text: "Or *tap* to start, *tap* to stop. Choose Auto, Hold or Toggle.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
