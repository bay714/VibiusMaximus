import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { ramp } from "../anim";
import { FPS } from "../theme";
import manifest from "./audio/manifest.json";
import { S0Open } from "./scenes/S0Open";
import { SBriefing } from "./scenes/SBriefing";
import { SSetup } from "./scenes/SSetup";
import { S1Dictate } from "./scenes/S1Dictate";
import { S2Capture } from "./scenes/S2Capture";
import { S3Send } from "./scenes/S3Send";
import { S4Carry } from "./scenes/S4Carry";
import { S5Board } from "./scenes/S5Board";
import { S6Macros } from "./scenes/S6Macros";
import { S7Hotkeys } from "./scenes/S7Hotkeys";
import { S8Finale } from "./scenes/S8Finale";
import { SCENES, TOTAL } from "./timeline";

/** Voiceover lines in frames (start times and measured lengths from audio/legion.py). */
const LINES = manifest.vo.map((v) => ({
  id: v.id,
  from: Math.round(v.start * FPS),
  to: Math.round((v.start + v.duration) * FPS),
}));

const MUSIC = 0.28;
const MUSIC_UNDER_VO = 0.1; // about 9 dB down under the voice
const linear = (t: number) => t;

const musicVolume = (f: number) => {
  let duck = 0;
  for (const v of LINES) {
    duck = Math.max(
      duck,
      Math.min(
        ramp(f, v.from - 8, v.from, 0, 1, linear),
        1 - ramp(f, v.to, v.to + 15, 0, 1, linear),
      ),
    );
  }
  return (
    (MUSIC + (MUSIC_UNDER_VO - MUSIC) * duck) *
    (1 - ramp(f, TOTAL - 20, TOTAL, 0, 1, linear))
  );
};

const Soundtrack: React.FC = () => (
  <>
    <Audio src={staticFile("audio/legion/music.mp3")} volume={musicVolume} />
    {LINES.map((v) => (
      <Sequence
        key={v.id}
        from={v.from}
        durationInFrames={v.to - v.from + 15}
        layout="none"
        name={`vo ${v.id}`}
      >
        <Audio src={staticFile(`audio/legion/vo/${v.id}.mp3`)} />
      </Sequence>
    ))}
  </>
);

/** The Legion how-to: eleven scenes back to back (storyboard v3 plus briefing and setup), voiceover, music and sounds. */
export const Legion: React.FC<{ audio?: boolean }> = ({ audio = true }) => (
  <AbsoluteFill style={{ background: "#0e0a08" }}>
    {audio && <Soundtrack />}
    <Series>
      <Series.Sequence durationInFrames={SCENES.open} name="Cold open">
        <S0Open />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.briefing} name="The briefing">
        <SBriefing />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.setup} name="Setup">
        <SSetup />
      </Series.Sequence>
      <Series.Sequence
        durationInFrames={SCENES.dictate}
        name="I Give the order"
      >
        <S1Dictate />
      </Series.Sequence>
      <Series.Sequence
        durationInFrames={SCENES.capture}
        name="II Mark the target"
      >
        <S2Capture />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.send} name="III Dispatch">
        <S3Send />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.carry} name="IV The courier">
        <S4Carry />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.board} name="V The campaign">
        <S5Board />
      </Series.Sequence>
      <Series.Sequence
        durationInFrames={SCENES.macros}
        name="VI Standing orders"
      >
        <S6Macros />
      </Series.Sequence>
      <Series.Sequence
        durationInFrames={SCENES.hotkeys}
        name="VII Headquarters"
      >
        <S7Hotkeys />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.finale} name="Finale">
        <S8Finale />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
