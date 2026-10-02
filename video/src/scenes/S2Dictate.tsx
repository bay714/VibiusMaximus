import React from "react";
import { useCurrentFrame } from "remotion";
import { lerp, pop, ramp, typedWords } from "../anim";
import { Caret, ChatComposer, ChatWindow } from "../components/ChatWindow";
import { KeyCombo } from "../components/Keycap";
import { Sfx } from "../components/Sfx";
import { Place, Scene } from "../components/Stage";
import { Waveform } from "../components/Waveform";
import { C } from "../theme";
import { SCENES } from "../timeline";

const HOLD_AT = 18;
const RELEASE = 112;
const TEXT_AT = 124;
const SAID = "Add a monthly and yearly toggle to the pricing page and show the yearly saving as a badge.";

/** Handy's small recording pill: mic, live level bars, then a "transcribing" pulse. */
const RecordingPill: React.FC = () => {
  const f = useCurrentFrame();
  const enter = pop(f, HOLD_AT + 2, { damping: 16, stiffness: 200 });
  const exit = ramp(f, TEXT_AT - 2, TEXT_AT + 6);
  if (f < HOLD_AT) return null;
  const level = f < RELEASE ? ramp(f, HOLD_AT + 4, HOLD_AT + 12) : 0.15;
  const working = f >= RELEASE;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 846,
        transform: `translateX(-50%) scale(${0.8 + 0.2 * enter})`,
        opacity: Math.min(1, enter) * (1 - exit),
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 20px 10px 12px",
        borderRadius: 999,
        background: "#0b0d12",
        border: `1px solid ${C.line}`,
        boxShadow: "0 14px 40px #000c",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: C.pin,
          display: "grid",
          placeItems: "center",
          boxShadow: `0 0 0 ${working ? 0 : 6}px #ff3b7f33`,
        }}
      >
        <svg width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <rect x="4" y="1" width="6" height="10" rx="3" fill="#fff" stroke="none" />
          <path d="M1.5 8.5a5.5 5.5 0 0 0 11 0M7 14v3" />
        </svg>
      </div>
      {working ? (
        <div style={{ color: C.muted, fontSize: 17, width: 150 }}>
          Transcribing{".".repeat(1 + (Math.floor(f / 5) % 3))}
        </div>
      ) : (
        <Waveform bars={22} height={30} barWidth={4} gap={3} level={level} />
      )}
    </div>
  );
};

/** 5–12 s: hold Ctrl+Space, talk, release → words land in the chat box. */
export const S2Dictate: React.FC = () => {
  const f = useCurrentFrame();
  const text = typedWords(SAID, f, TEXT_AT, 2.4);
  const push = ramp(f, 0, SCENES.dictate, 0, 1, (t) => t);

  return (
    <Scene
      dur={SCENES.dictate}
      captions={[{ from: 8, to: 198, text: "Hold {Ctrl+Space} and talk — *offline*, in any app." }]}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${lerp(1, 1.035, push)})`, transformOrigin: "50% 80%" }}>
        <Place x={336} y={44} scale={1.3}>
          <ChatWindow
            composer={
              <ChatComposer>
                {text ? (
                  <>
                    {text}
                    <Caret solid={f < TEXT_AT + 60} />
                  </>
                ) : undefined}
              </ChatComposer>
            }
          >
            <div style={{ textAlign: "center", marginTop: 120, fontSize: 26, fontWeight: 600, color: "#c9cdd8" }}>
              What are we building today?
            </div>
            <div style={{ textAlign: "center", marginTop: 8, fontSize: 14, color: C.muted }}>
              Your cursor is in the message box.
            </div>
          </ChatWindow>
        </Place>
      </div>
      <RecordingPill />
      <Sfx at={HOLD_AT + 2} name="pop" volume={0.22} />
      <Sfx at={TEXT_AT} name="drop" volume={0.2} />
      <KeyCombo keys={["Ctrl", "Space"]} at={HOLD_AT} hold={RELEASE - HOLD_AT} />
    </Scene>
  );
};
