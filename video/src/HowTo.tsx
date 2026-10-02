import React from "react";
import { Series } from "remotion";
import { S1Hook } from "./scenes/S1Hook";
import { S2Dictate } from "./scenes/S2Dictate";
import { S3Capture } from "./scenes/S3Capture";
import { S4Send } from "./scenes/S4Send";
import { S5Board } from "./scenes/S5Board";
import { S6Macros } from "./scenes/S6Macros";
import { S7Outro } from "./scenes/S7Outro";
import { SCENES } from "./timeline";

/** The full ~70 s how-to video: seven scenes back to back. */
export const HowTo: React.FC = () => (
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
);
