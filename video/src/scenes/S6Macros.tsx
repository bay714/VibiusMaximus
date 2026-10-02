import React from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, pop, ramp, typed } from "../anim";
import { Bubble, Caret, ChatComposer, ChatWindow } from "../components/ChatWindow";
import { Kbd, KeyCombo } from "../components/Keycap";
import { Camera, Place, Scene } from "../components/Stage";
import { C } from "../theme";
import { SCENES } from "../timeline";

const TYPED = "Add a monthly / yearly toggle to the pricing page.";
const MACRO =
  " Use our existing components and Tailwind tokens. Don't add new colours, fonts or spacing values. If a component is missing, tell me first.";
const TYPE_AT = 10;
const KEY_AT = 84;
const INSERT_AT = 92;

const MACROS = ["Plan first", "Match design system", "Don't touch tests", "Small diff"];

/** Floating list of the four starter macros; the one fired lights up. */
const MacroCard: React.FC = () => {
  const f = useCurrentFrame();
  const enter = pop(f, KEY_AT - 4, { damping: 18, stiffness: 160 });
  const exit = ramp(f, 196, 210);
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        bottom: 196,
        width: 270,
        padding: 8,
        borderRadius: 12,
        background: C.panel,
        border: `1px solid ${C.line}`,
        boxShadow: "0 16px 40px #000b",
        opacity: Math.min(1, enter) * (1 - exit),
        transform: `translateY(${(1 - enter) * 12}px)`,
      }}
    >
      <div style={{ fontSize: 10.5, letterSpacing: ".08em", color: C.muted, padding: "4px 8px 6px" }}>PROMPT MACROS</div>
      {MACROS.map((m, i) => {
        const on = i === 1 && f >= KEY_AT;
        return (
          <div
            key={m}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 8px",
              borderRadius: 7,
              fontSize: 13.5,
              background: on ? C.accent : "transparent",
              color: on ? "#fff" : C.text,
            }}
          >
            <Kbd keys={`Alt+${i + 1}`} size={18} />
            {m}
          </div>
        );
      })}
    </div>
  );
};

/** 52–60 s: half-typed message, Alt+2 appends a saved prompt at the cursor. */
export const S6Macros: React.FC = () => {
  const f = useCurrentFrame();
  const text = typed(TYPED, f, TYPE_AT, 1.1);
  const inserted = f >= INSERT_AT;
  const flash = ramp(f, INSERT_AT, INSERT_AT + 50);
  const zoom = ramp(f, 0, 70, 0, 1, easeInOut);

  return (
    <Scene
      dur={SCENES.macros}
      captions={[
        { from: 6, to: 80, text: "Halfway through a message? Press {Alt+2}." },
        { from: 88, to: 230, text: "One key, your *favourite prompts*." },
      ]}
    >
      <Camera p={zoom} zoom={1.1} focus={{ x: 1060, y: 600 }} to={{ x: 990, y: 540 }}>
        <Place x={288} y={52} scale={1.4}>
          <ChatWindow
            active={2}
            convos={["Acme landing page fixes", "Auth refactor", "Pricing table"]}
            composer={
              <ChatComposer>
                {text ? (
                  <>
                    {text}
                    {inserted && (
                      <span
                        style={{
                          background: `rgba(139,92,246,${0.5 - 0.3 * flash})`,
                          borderRadius: 3,
                          boxShadow: `0 0 0 2px rgba(139,92,246,${0.5 - 0.3 * flash})`,
                        }}
                      >
                        {MACRO}
                      </span>
                    )}
                    <Caret solid={f < TYPE_AT + 50} />
                  </>
                ) : undefined}
              </ChatComposer>
            }
            overlay={<MacroCard />}
          >
            <Bubble from="you">The pricing table is done. What's next?</Bubble>
            <Bubble from="ai">Next up is the billing period switch. Tell me how you want it to behave.</Bubble>
          </ChatWindow>
        </Place>
      </Camera>
      <KeyCombo keys={["Alt", "2"]} at={KEY_AT} hold={10} pos="topRight" />
    </Scene>
  );
};
