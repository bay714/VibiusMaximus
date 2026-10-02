import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

export type SfxName = "click" | "whoosh" | "shutter" | "pop" | "drop" | "chime" | "sparkle";

/** A one-shot UI sound at frame `at` of the enclosing sequence (files built by audio/build.py). */
export const Sfx: React.FC<{ at: number; name: SfxName; volume?: number }> = ({ at, name, volume = 0.5 }) => (
  <Sequence from={Math.round(at)} durationInFrames={45} layout="none" name={`sfx ${name}`}>
    <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume} />
  </Sequence>
);
