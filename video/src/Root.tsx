import React from "react";
import { Composition } from "remotion";
import { HowTo } from "./HowTo";
import { FPS, H, W } from "./theme";
import { TOTAL } from "./timeline";

export const Root: React.FC = () => (
  <Composition id="HowTo" component={HowTo} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
