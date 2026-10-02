import React from "react";
import { AbsoluteFill, Freeze, useCurrentFrame } from "remotion";
import { easeInOut, pop, ramp } from "../anim";
import { AcmeCrop, CLEAN, NOTES } from "../components/AcmePage";
import { Bubble, Caret, ChatComposer, ChatWindow } from "../components/ChatWindow";
import { KeyCombo } from "../components/Keycap";
import { Sfx } from "../components/Sfx";
import { Place, Scene } from "../components/Stage";
import { Toast } from "../components/Toast";
import { Window } from "../components/Window";
import { C, MONO } from "../theme";
import { SCENES } from "../timeline";
import { CaptureStage } from "./capture/CaptureStage";

const ENTER = 6;
const IMAGE_AT = 42;
const TEXT_AT = 62;
const CUT = 180;
const TERM_ENTER = 190;
const TERM_PASTE = 198;

const LINES = ["[screenshot above]", CLEAN, ...NOTES.map((n, i) => `${i + 1}. ${n}`)];
const PATH = "C:\\Users\\you\\AppData\\Roaming\\VibiusMaximus\\captures\\2026-10-01_142233.png";

const ChatSide: React.FC = () => {
  const f = useCurrentFrame();
  const img = pop(f, IMAGE_AT, { damping: 16, stiffness: 150 });
  const pasted = f >= TEXT_AT;
  return (
    <ChatWindow
      composer={
        <ChatComposer
          attachments={
            f >= IMAGE_AT ? (
              <div style={{ opacity: Math.min(1, img), transform: `translateY(${(1 - img) * -28}px) scale(${0.92 + 0.08 * img})`, transformOrigin: "0 0" }}>
                <AcmeCrop scale={0.8} />
              </div>
            ) : undefined
          }
        >
          {pasted || f >= IMAGE_AT ? (
            <>
              {LINES.map((l, i) => {
                const o = ramp(f, TEXT_AT + i * 3, TEXT_AT + i * 3 + 6);
                return o > 0 ? (
                  <div key={i} style={{ opacity: o, color: i === 0 ? C.muted : C.text }}>
                    {l}
                    {i === LINES.length - 1 && <Caret />}
                  </div>
                ) : null;
              })}
            </>
          ) : undefined}
        </ChatComposer>
      }
      overlay={<Toast at={TEXT_AT + 18} right={24} top={64} text="Pasted image + text · clipboard restored" />}
    >
      <Bubble from="ai">Sure. Show me what you'd like to change on the landing page.</Bubble>
    </ChatWindow>
  );
};

const TerminalSide: React.FC = () => {
  const f = useCurrentFrame();
  const pasted = f >= TERM_PASTE;
  const o = (i: number) => ramp(f, TERM_PASTE + i * 2, TERM_PASTE + i * 2 + 5);
  return (
    <Window
      x={0}
      y={0}
      w={960}
      h={600}
      variant="terminal"
      title={
        <span
          style={{
            padding: "5px 14px",
            borderRadius: "6px 6px 0 0",
            background: "#1b1d22",
            color: C.text,
            fontSize: 12.5,
            marginTop: 6,
          }}
        >
          ❯_ PowerShell
        </span>
      }
    >
      <div style={{ position: "relative", padding: "18px 22px", fontFamily: MONO, fontSize: 14, lineHeight: 1.6, color: "#d4d4d4" }}>
        <div>
          <span style={{ color: C.muted }}>PS C:\code\acme&gt;</span> claude
        </div>
        <div style={{ margin: "10px 0 14px", border: "1px solid #d97757", borderRadius: 6, padding: "8px 14px", width: 420 }}>
          <div>
            <span style={{ color: "#d97757" }}>✻</span> Welcome to <b>Claude Code</b>
          </div>
          <div style={{ color: C.muted }}>cwd: C:\code\acme</div>
        </div>
        <div style={{ border: "1px solid #4b5160", borderRadius: 6, padding: "10px 14px", display: "flex", gap: 10 }}>
          <span style={{ color: C.muted }}>&gt;</span>
          <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>
            {pasted ? (
              <>
                <div style={{ opacity: o(0), color: C.accent2 }}>{PATH}</div>
                {[CLEAN, ...NOTES.map((n, i) => `${i + 1}. ${n}`)].map((l, i) => (
                  <div key={i} style={{ opacity: o(i + 1) }}>
                    {l}
                  </div>
                ))}
              </>
            ) : null}
            <span style={{ display: "inline-block", width: 9, height: 17, verticalAlign: "-3px", background: "#d4d4d4", opacity: Math.floor(f / 15) % 2 ? 0.2 : 1 }} />
          </div>
        </div>
        <div style={{ color: C.muted, fontSize: 12.5, marginTop: 6 }}>? for shortcuts</div>
      </div>
      <Toast at={TERM_PASTE + 12} right={20} top={14} text="Pasted file path + text · clipboard restored" />
    </Window>
  );
};

/** 30–40 s: Enter sends image + text into the chat; a terminal gets a file path instead. */
export const S4Send: React.FC = () => {
  const f = useCurrentFrame();
  const close = ramp(f, ENTER + 6, ENTER + 16, 0, 1, easeInOut);
  const chatIn = pop(f, ENTER + 15, { damping: 200, stiffness: 120 });
  const chatOut = ramp(f, CUT - 4, CUT + 2);
  const termIn = ramp(f, CUT - 2, CUT + 4);

  return (
    <Scene
      dur={SCENES.send}
      fadeIn={0}
      captions={[
        { from: 4, to: 168, text: "{Enter} pastes the image, then the numbered text, into your chat." },
        { from: CUT + 4, to: 290, text: "Terminals get a file path for *Claude Code*." },
      ]}
    >
      {close < 1 && (
        <AbsoluteFill style={{ opacity: 1 - close, transform: `scale(${1 - 0.04 * close})` }}>
          <Freeze frame={SCENES.capture - 1}>
            <CaptureStage />
          </Freeze>
        </AbsoluteFill>
      )}
      {f >= ENTER + 15 && chatOut < 1 && (
        <AbsoluteFill style={{ opacity: Math.min(1, chatIn) * (1 - chatOut), transform: `scale(${0.97 + 0.03 * chatIn})` }}>
          <Place x={288} y={52} scale={1.4}>
            <ChatSide />
          </Place>
        </AbsoluteFill>
      )}
      {termIn > 0 && (
        <AbsoluteFill style={{ opacity: termIn }}>
          <Place x={288} y={52} scale={1.4}>
            <TerminalSide />
          </Place>
        </AbsoluteFill>
      )}
      <KeyCombo keys={["Enter"]} at={ENTER} hold={8} pos="topRight" />
      <Sfx at={ENTER + 6} name="whoosh" volume={0.35} />
      <Sfx at={IMAGE_AT} name="drop" volume={0.35} />
      <Sfx at={TEXT_AT + 18} name="chime" volume={0.3} />
      <Sfx at={CUT - 4} name="whoosh" volume={0.25} />
      <Sfx at={TERM_PASTE} name="drop" volume={0.25} />
      <Sfx at={TERM_PASTE + 12} name="chime" volume={0.3} />
      <KeyCombo keys={["Enter"]} at={TERM_ENTER} hold={6} pos="topRight" />
    </Scene>
  );
};
