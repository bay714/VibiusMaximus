import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../../anim";
import { Backdrop, Captions, Chip, SceneFade, Sfx, Win } from "../kit";
import { HotkeysPage, Sidebar } from "../pieces";

export const S7Hotkeys: React.FC = () => {
  const f = useCurrentFrame();
  const win = pop(f, 0);
  const sweep = ramp(f, 8, 46, -1, 10, (t) => t);
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
            x={330}
            y={150}
            w={1260}
            h={800}
            title="Vibius Maximus"
            kind="vibe"
          >
            <div style={{ display: "flex", height: "100%" }}>
              <Sidebar
                active={sweep >= 3 ? "hotkeys" : "general"}
                sweep={sweep}
              />
              <HotkeysPage
                rows={Math.floor(ramp(f, 26, 96, 0, 18, (t) => t))}
              />
            </div>
          </Win>
        </div>
        <Chip n={7} titles={[[0, "Headquarters"]]} />
        <Sfx at={22} name="chime" volume={0.35} />
        <Captions
          items={[
            {
              from: 12,
              to: 158,
              text: "Every key at its post, and *every one* yours to change.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
