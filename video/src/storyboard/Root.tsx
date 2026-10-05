import React from "react";
import { AbsoluteFill, Composition, useCurrentFrame } from "remotion";
import { PANELS } from "./panels";
import { DISPLAY, L, SANS, ShieldMark } from "./ui";

/** One storyboard panel per frame: render with --sequence to get every frame as a PNG. */
const Frames: React.FC = () => {
  const P = PANELS[useCurrentFrame()].C;
  return <P />;
};

const CELL_W = 600;
const SCALE = CELL_W / 1920;
const CELL_H = 1080 * SCALE;
const GAP = 44;
const HEAD = 150;
const TEXT_H = 190;
export const SHEET_W = GAP + 3 * (CELL_W + GAP);
export const SHEET_H = HEAD + Math.ceil(PANELS.length / 3) * (CELL_H + TEXT_H) + GAP;

/** All panels on one page, each with its time, narration and a production note. */
const Sheet: React.FC = () => (
  <AbsoluteFill style={{ background: "#0f0b09", color: L.text, fontFamily: SANS, padding: `0 ${GAP}px` }}>
    <div style={{ height: HEAD, display: "flex", alignItems: "center", gap: 22 }}>
      <ShieldMark size={70} />
      <div>
        <div style={{ fontFamily: DISPLAY, fontSize: 40, letterSpacing: "0.06em" }}>VibiusMaximus how-to — storyboard v3</div>
        <div style={{ color: L.muted, fontSize: 19, marginTop: 6 }}>
          Legion · dark · Roman-general framing · ~100 s · checked against v1.0.3 · tagline “Veni, vidi, vibed” · 2026-10-05
        </div>
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(3, ${CELL_W}px)`, columnGap: GAP }}>
      {PANELS.map(({ id, time, title, vo, note, C }) => (
        <div key={id} style={{ height: CELL_H + TEXT_H }}>
          <div style={{ width: CELL_W, height: CELL_H, overflow: "hidden", borderRadius: 6, outline: `1px solid ${L.line}`, position: "relative" }}>
            <div style={{ width: 1920, height: 1080, transform: `scale(${SCALE})`, transformOrigin: "0 0", position: "relative" }}>
              <C />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginTop: 12 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 24 }}>{title}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: L.muted, fontSize: 17 }}>{time}</span>
          </div>
          <div style={{ fontSize: 17, lineHeight: 1.4, marginTop: 6, color: L.text }}>
            <span style={{ color: L.bronze2 }}>VO </span>“{vo}”
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.35, marginTop: 6, color: L.muted }}>{note}</div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <>
    <Composition id="Frames" component={Frames} durationInFrames={PANELS.length} fps={30} width={1920} height={1080} />
    <Composition id="Sheet" component={Sheet} durationInFrames={1} fps={30} width={SHEET_W} height={Math.ceil(SHEET_H)} />
  </>
);
