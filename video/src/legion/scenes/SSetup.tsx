import React from "react";
import { useCurrentFrame } from "remotion";
import { along, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  L,
  SANS,
  SceneFade,
  Sfx,
  ShieldMark,
  Win,
  Wordmark,
} from "../kit";

// The first-run screen (src/components/onboarding): the two top picks from the model catalog.
// Canary 180M Flash is ranked first; sizes are the default Q8_0 downloads.
const MODELS = [
  {
    name: "Canary 180M Flash",
    line: "Tiny and instant, runs well on any hardware",
    accuracy: 0.88,
    speed: 0.98,
    tags: ["4 languages", "Translate"],
    size: "218 MB",
  },
  {
    name: "Parakeet Unified EN 0.6B",
    line: "Fast, accurate live English transcription",
    accuracy: 0.9,
    speed: 0.79,
    tags: ["English only", "Streaming"],
    size: "731 MB",
  },
];

// VO (scene-relative): "setup" at 12, "offline" at 228.
const CALLOUT = 46;
const CLICK = 80;
const DL = [86, 240] as const; // downloading 0→100 %
const DONE = 246;

// Window and card geometry on screen.
const WX = 460;
const WY = 140;
const CARD_X = WX + 200;
const CARD_Y = WY + 42 + 300;

const Bar: React.FC<{ label: string; v: number }> = ({ label, v }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <span
      style={{ width: 80, textAlign: "right", fontSize: 14, color: L.muted }}
    >
      {label}
    </span>
    <span
      style={{
        width: 70,
        height: 6,
        borderRadius: 3,
        background: "#8c7b6a33",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          display: "block",
          width: `${v * 100}%`,
          height: "100%",
          borderRadius: 3,
          background: L.bronze2,
        }}
      />
    </span>
  </div>
);

const ModelCard: React.FC<{
  i: number;
  progress?: number;
  active?: boolean;
  hover?: boolean;
}> = ({ i, progress, active, hover }) => {
  const m = MODELS[i];
  const downloading = progress !== undefined && !active;
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "14px 18px 12px",
        border: `2px solid ${active ? `${L.bronze2}80` : hover ? `${L.bronze2}80` : `${L.bronze2}40`}`,
        background: active ? `${L.bronze2}1a` : `${L.bronze2}0d`,
        transform: hover && !downloading && !active ? "scale(1.01)" : undefined,
        boxShadow: hover ? "0 12px 30px #0006" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 19, fontWeight: 600, color: L.text }}>
              {m.name}
            </span>
            {active && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: L.bg,
                  background: L.bronze2,
                  borderRadius: 6,
                  padding: "2px 8px",
                }}
              >
                ✓ Active
              </span>
            )}
          </div>
          <div style={{ fontSize: 15, color: L.muted, marginTop: 4 }}>
            {m.line}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Bar label="accuracy" v={m.accuracy} />
          <Bar label="speed" v={m.speed} />
        </div>
      </div>
      <div style={{ height: 1, background: "#8c7b6a33" }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 13,
          color: "#a8988acc",
        }}
      >
        <span>🌐 {m.tags[0]}</span>
        <span>⇄ {m.tags[1]}</span>
        <span style={{ marginLeft: "auto" }}>
          {active ? "🖴" : "⤓"} {m.size}
        </span>
      </div>
      {downloading && (
        <div>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "#8c7b6a33",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                borderRadius: 3,
                background: L.bronze2,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginTop: 6,
              color: L.muted,
            }}
          >
            <span>Downloading {Math.round(progress ?? 0)}%</span>
            <span>
              {(18 + 6 * Math.sin((progress ?? 0) / 9)).toFixed(1)} MB/s{" "}
              <span style={{ color: "#f07060", marginLeft: 12 }}>Cancel</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const PATH: [number, number, number][] = [
  [30, 1320, 860],
  [CLICK - 6, CARD_X + 320, CARD_Y + 40],
  [DONE + 30, CARD_X + 420, CARD_Y + 160],
];

export const SSetup: React.FC = () => {
  const f = useCurrentFrame();
  const win = pop(f, 2);
  const progress =
    f >= DL[0] ? ramp(f, DL[0], DL[1], 0, 100, (t) => t) : undefined;
  const active = f >= DONE;
  const callout = pop(f, CALLOUT) * (1 - ramp(f, CLICK + 10, CLICK + 20));
  const pos = along(f, PATH);
  return (
    <SceneFade>
      <Backdrop>
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: win,
            transform: `scale(${0.96 + 0.04 * win})`,
          }}
        >
          <Win
            x={WX}
            y={WY}
            w={1000}
            h={800}
            title="Vibius Maximus"
            kind="vibe"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "30px 200px 0",
                fontFamily: SANS,
                color: L.text,
              }}
            >
              <ShieldMark size={96} />
              <div style={{ marginTop: 8 }}>
                <div style={{ textAlign: "center" }}>
                  <Wordmark size={24} stacked />
                </div>
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: "#f1e6d6b3",
                  marginTop: 18,
                }}
              >
                To get started, choose a transcription model
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  fontSize: 15,
                  fontWeight: 500,
                  color: "#f1e6d699",
                  margin: "26px 0 12px",
                }}
              >
                Available to Download
              </div>
              <div
                style={{
                  alignSelf: "stretch",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <ModelCard
                  i={0}
                  progress={progress}
                  active={active}
                  hover={f >= CLICK - 10 && f < DL[0]}
                />
                <ModelCard i={1} />
              </div>
            </div>
          </Win>
        </div>
        {/* the video's own pointer to the model to pick (not app UI) */}
        {callout > 0 && (
          <div
            style={{
              position: "absolute",
              left: CARD_X - 250,
              top: CARD_Y + 20,
              opacity: callout,
              transform: `translateX(${(1 - callout) * -20}px)`,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span
              style={{ fontFamily: DISPLAY, fontSize: 30, color: L.bronze2 }}
            >
              Recommended
            </span>
            <span style={{ fontSize: 34, color: L.bronze2 }}>→</span>
          </div>
        )}
        {f >= 30 && f < DONE + 40 && (
          <Cursor
            x={pos.x}
            y={pos.y}
            clicks={[CLICK]}
            opacity={1 - ramp(f, DONE + 24, DONE + 36)}
          />
        )}
        <Chip n={0} kicker="SETUP" titles={[[0, "Arm your legion"]]} />
        <Sfx at={CLICK} name="click" volume={0.5} />
        <Sfx at={DONE} name="chime" volume={0.4} />
        <Captions
          items={[
            {
              from: 10,
              to: 222,
              text: "First launch: pick *Canary 180M Flash*, the recommended model.",
            },
            {
              from: 228,
              to: 352,
              text: "One small download. Your voice *stays on your PC*.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
