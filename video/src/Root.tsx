import React from "react";
import { Composition } from "remotion";
import { HowTo } from "./HowTo";
import { Legion } from "./legion/Legion";
import { TOTAL as LEGION_TOTAL } from "./legion/timeline";
import { FPS, H, W } from "./theme";
import { TOTAL } from "./timeline";

export const Root: React.FC = () => (
  <>
    <Composition id="Legion" component={Legion} durationInFrames={LEGION_TOTAL} fps={FPS} width={W} height={H} defaultProps={{ audio: true }} />
    <Composition id="HowTo" component={HowTo} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
  </>
);
