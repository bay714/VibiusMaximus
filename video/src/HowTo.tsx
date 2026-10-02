import React from "react";
import { AbsoluteFill, Audio, Sequence, Series, staticFile } from "remotion";
import { ramp } from "./anim";
import manifest from "./audio/manifest.json";
import { S1Hook } from "./scenes/S1Hook";
import { S2Dictate } from "./scenes/S2Dictate";
import { S3Capture } from "./scenes/S3Capture";
import { S4Send } from "./scenes/S4Send";
import { S5Board } from "./scenes/S5Board";
import { S6Macros } from "./scenes/S6Macros";
import { S7Outro } from "./scenes/S7Outro";
import { FPS } from "./theme";
import { SCENES, TOTAL } from "./timeline";

/** Voiceover lines in frames (timings measured by audio/build.py). */
const VO = manifest.vo.map((v) => ({
  id: v.id,
  from: Math.round(v.start * FPS),
  to: Math.round((v.start + v.duration) * FPS),
}));

const MUSIC = 0.36; // music level on its own
const MUSIC_UNDER_VO = 0.13; // ducked about 9 dB under the voice
const linear = (t: number) => t;

/** Music volume per frame: dips under each voiceover line, fades out at the very end. */
const musicVolume = (f: number) => {
  let duck = 0;
  for (const v of VO) {
    duck = Math.max(duck, Math.min(ramp(f, v.from - 8, v.from, 0, 1, linear), 1 - ramp(f, v.to, v.to + 15, 0, 1, linear)));
  }
  return (MUSIC + (MUSIC_UNDER_VO - MUSIC) * duck) * (1 - ramp(f, TOTAL - 30, TOTAL, 0, 1, linear));
};

const Soundtrack: React.FC = () => (
  <>
    <Audio src={staticFile("audio/music.mp3")} volume={musicVolume} />
    {VO.map((v) => (
      <Sequence key={v.id} from={v.from} durationInFrames={v.to - v.from + 15} layout="none" name={`vo ${v.id}`}>
        <Audio src={staticFile(`audio/vo/${v.id}.mp3`)} volume={1} />
      </Sequence>
    ))}
  </>
);

/** The full how-to video: seven scenes back to back, with voiceover, music and UI sounds. */
export const HowTo: React.FC = () => (
  <AbsoluteFill>
    <Soundtrack />
    <Series>
      <Series.Sequence durationInFrames={SCENES.hook}>
        <S1Hook />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.dictate}>
        <S2Dictate />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.capture}>
        <S3Capture />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.send}>
        <S4Send />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.board}>
        <S5Board />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.macros}>
        <S6Macros />
      </Series.Sequence>
      <Series.Sequence durationInFrames={SCENES.outro}>
        <S7Outro />
      </Series.Sequence>
    </Series>
  </AbsoluteFill>
);
