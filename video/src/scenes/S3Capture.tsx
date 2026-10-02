import React from "react";
import { KeyCombo } from "../components/Keycap";
import { Sfx } from "../components/Sfx";
import { Scene } from "../components/Stage";
import { SCENES } from "../timeline";
import { CaptureStage, T } from "./capture/CaptureStage";

/** 12–30 s: freeze, select, annotate, pins, spoken caption, Ctrl+K cleanup. */
export const S3Capture: React.FC = () => (
  <Scene
    dur={SCENES.capture}
    fadeOut={0}
    captions={[
      { from: 6, to: 132, text: "Press {Alt+Shift+S}. The screen freezes. Drag over what to change." },
      { from: 140, to: 306, text: "Draw on it. {Alt+P} drops numbered pins: speak a note for each." },
      { from: 312, to: 398, text: "Hold {Ctrl+Space} and say the overall request." },
      { from: 404, to: 528, text: "{Ctrl+K} ✨ turns rambling into a clean instruction." },
    ]}
  >
    <CaptureStage />
    <Sfx at={T.freeze} name="shutter" volume={0.45} />
    <Sfx at={T.editorIn} name="whoosh" volume={0.25} />
    <Sfx at={T.boxEnd} name="drop" volume={0.18} />
    {T.pins.map((at) => (
      <Sfx key={at} at={at} name="pop" volume={0.32} />
    ))}
    <Sfx at={T.cleanKey + 4} name="sparkle" volume={0.35} />
    <KeyCombo keys={["Alt", "Shift", "S"]} at={T.combo} hold={22} pos="topRight" />
    <KeyCombo keys={["B"]} at={T.boxKey} hold={8} pos="topRight" />
    <KeyCombo keys={["Alt", "P"]} at={T.pinKey} hold={10} pos="topRight" />
    <KeyCombo keys={["Ctrl", "Space"]} at={T.capStart - 2} hold={T.capEnd - T.capStart} pos="topRight" />
    <KeyCombo keys={["Ctrl", "K"]} at={T.cleanKey} hold={10} pos="topRight" />
  </Scene>
);
