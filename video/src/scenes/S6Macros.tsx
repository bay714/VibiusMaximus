import React from "react";
import { useCurrentFrame } from "remotion";
import { easeInOut, pop, ramp, typed } from "../anim";
import { Bubble, Caret, ChatComposer, ChatWindow } from "../components/ChatWindow";
import { Kbd, KeyCombo } from "../components/Keycap";
import { Sfx } from "../components/Sfx";
import { Camera, Place, Scene } from "../components/Stage";
import { C, MONO } from "../theme";
import { SCENES } from "../timeline";

// Example 1: half-typed message + Alt+2
const TYPED = "Add a monthly / yearly toggle to the pricing page.";
const MACRO_2 =
  " Use our existing components and Tailwind tokens. Don't add new colours, fonts or spacing values. If a component is missing, tell me first.";
const TYPE_AT = 10;
const KEY_AT = 84;
const INSERT_AT = 92;

// Example 2: send → a wall of text comes back → follow-up + Alt+4
const SEND_AT = 200;
const STREAM_AT = 216;
const STREAM_END = 326;
const FOLLOW_AT = 336;
const FOLLOW = "Which of these do we actually need for launch?";
const KEY2_AT = 420;
const INSERT2_AT = 428;
const MACRO_4 =
  " Summarize your results concisely in 2-3 sentences for each topic. Make sure to give context for each topic and don't use any made-up jargon.";

const MACROS = ["Plan first", "Match design system", "Don't touch tests", "Summarize concisely"];

type Block = { k: "p" | "h" | "li" | "code"; t: string };
/** The long answer the AI streams back in example 2. */
const ANSWER: Block[] = [
  { k: "p", t: "Here's a complete plan for the monthly / yearly toggle, covering state, display, billing, analytics, accessibility and testing." },
  { k: "h", t: "1. State and URL" },
  { k: "li", t: "Keep the billing period in the URL (?period=yearly) so links and refreshes keep the choice." },
  { k: "li", t: "Default to monthly and remember the last choice in localStorage for returning visitors." },
  { k: "code", t: "const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');" },
  { k: "h", t: "2. Price display" },
  { k: "li", t: "Show the yearly price as a per-month figure, with the annual total underneath." },
  { k: "li", t: "Add a 'Save 20%' badge to the yearly option using the existing Badge component." },
  { k: "li", t: "Animate the number change with the existing CountUp helper rather than a new library." },
  { k: "h", t: "3. Proration" },
  { k: "li", t: "Switching mid-cycle should prorate through Stripe, so nobody pays twice for the same days." },
  { k: "li", t: "Show a confirmation dialog with the exact amount before the switch is applied." },
  { k: "h", t: "4. Tax and currency" },
  { k: "li", t: "Read prices from the Stripe price objects so tax-inclusive regions keep working." },
  { k: "li", t: "Round per-month figures down and always show the exact annual total." },
  { k: "h", t: "5. Analytics" },
  { k: "li", t: "Track toggle_changed and checkout_started with the selected period." },
  { k: "h", t: "6. Accessibility" },
  { k: "li", t: "Use a radio group with arrow-key support instead of two separate buttons." },
  { k: "li", t: "Announce price changes to screen readers with an aria-live region." },
  { k: "h", t: "7. Edge cases" },
  { k: "li", t: "Enterprise plans have no yearly price, so hide the toggle for them." },
  { k: "li", t: "Monthly-only coupons need a clear message when yearly is selected." },
  { k: "h", t: "8. Testing" },
  { k: "li", t: "Unit-test the price formatting and add a Playwright test for the toggle and the URL." },
  { k: "li", t: "Snapshot both periods in light and dark mode." },
  { k: "p", t: "Want me to start with the state and display changes, or the billing side first?" },
];
const ANSWER_CHARS = ANSWER.reduce((n, b) => n + b.t.length, 0);

/** Streams `ANSWER` character by character; the newest text sits at the bottom. */
const Answer: React.FC<{ progress: number }> = ({ progress }) => {
  let budget = Math.floor(progress * ANSWER_CHARS);
  const streaming = progress < 1;
  const shown = ANSWER.map((b) => {
    const t = b.t.slice(0, Math.max(0, budget));
    budget -= b.t.length;
    return { ...b, t };
  }).filter((b) => b.t.length > 0);

  return (
    <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#c9cdd8", paddingRight: 8 }}>
      {shown.map((b, i) => {
        const caret = streaming && i === shown.length - 1 ? <Caret solid height={15} /> : null;
        if (b.k === "h")
          return (
            <div key={i} style={{ fontWeight: 700, color: C.text, fontSize: 15.5, marginTop: 12, marginBottom: 2 }}>
              {b.t}
              {caret}
            </div>
          );
        if (b.k === "li")
          return (
            <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 6 }}>
              <span style={{ color: C.muted }}>•</span>
              <span>
                {b.t}
                {caret}
              </span>
            </div>
          );
        if (b.k === "code")
          return (
            <div
              key={i}
              style={{
                margin: "6px 0",
                padding: "8px 12px",
                borderRadius: 8,
                background: "#0b0d12",
                border: `1px solid ${C.line}`,
                fontFamily: MONO,
                fontSize: 12.5,
                color: "#a5b4fc",
              }}
            >
              {b.t}
              {caret}
            </div>
          );
        return (
          <div key={i} style={{ marginTop: i === 0 ? 0 : 12 }}>
            {b.t}
            {caret}
          </div>
        );
      })}
    </div>
  );
};

/** Inserted macro text: bright violet when it lands, settling to a soft highlight. */
const Inserted: React.FC<{ text: string; at: number }> = ({ text, at }) => {
  const f = useCurrentFrame();
  const a = 0.5 - 0.3 * ramp(f, at, at + 50);
  return (
    <span style={{ background: `rgba(139,92,246,${a})`, borderRadius: 3, boxShadow: `0 0 0 2px rgba(139,92,246,${a})` }}>
      {text}
    </span>
  );
};

/** Floating list of the saved macros; the one just fired lights up. */
const MacroCard: React.FC = () => {
  const f = useCurrentFrame();
  const first = f < SEND_AT;
  const enter = pop(f, (first ? KEY_AT : KEY2_AT) - 4, { damping: 18, stiffness: 160 });
  const exit = first ? ramp(f, 186, 198) : ramp(f, 540, 556);
  const active = first ? 1 : 3;
  if (enter <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        right: 40,
        bottom: 200,
        width: 290,
        padding: 8,
        borderRadius: 12,
        background: C.panel,
        border: `1px solid ${C.line}`,
        boxShadow: "0 16px 40px #000b",
        opacity: Math.min(1, enter) * (1 - exit),
        transform: `translateY(${(1 - enter) * 12}px)`,
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: 10.5, letterSpacing: ".08em", color: C.muted, padding: "4px 8px 6px" }}>PROMPT MACROS</div>
      {MACROS.map((m, i) => {
        const on = i === active;
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

/** "Stop generating" pill and a scrollbar whose thumb shrinks as the answer grows. */
const StreamingChrome: React.FC<{ progress: number }> = ({ progress }) => {
  const f = useCurrentFrame();
  const show = Math.min(ramp(f, STREAM_AT, STREAM_AT + 8), 1 - ramp(f, STREAM_END, STREAM_END + 8));
  if (f < STREAM_AT) return null;
  return (
    <>
      <div style={{ position: "absolute", right: 10, top: 14, bottom: 150, width: 5, borderRadius: 3, background: "#ffffff0a" }}>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: `${(1 - 0.86 * progress) * 100}%`,
            borderRadius: 3,
            background: "#ffffff30",
          }}
        />
      </div>
      {show > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 128,
            transform: "translateX(-50%)",
            opacity: show,
            padding: "6px 14px",
            borderRadius: 999,
            background: C.panel2,
            border: `1px solid ${C.line}`,
            color: C.muted,
            fontSize: 12.5,
            whiteSpace: "nowrap",
          }}
        >
          ■ Stop generating
        </div>
      )}
    </>
  );
};

/**
 * 52–71 s: prompt macros, twice.
 * 1) Half-typed message, Alt+2 appends a saved prompt.
 * 2) Send → a long answer streams back → type a follow-up → Alt+4 appends the summary prompt.
 */
export const S6Macros: React.FC = () => {
  const f = useCurrentFrame();
  const sent = f >= SEND_AT;
  const sentIn = pop(f, SEND_AT + 2, { damping: 200, stiffness: 160 });
  const progress = ramp(f, STREAM_AT, STREAM_END, 0, 1, (t) => t);
  const zoom =
    ramp(f, 0, 70, 0, 1, easeInOut) -
    ramp(f, SEND_AT, SEND_AT + 30, 0, 1, easeInOut) +
    ramp(f, FOLLOW_AT - 10, FOLLOW_AT + 26, 0, 1, easeInOut);

  const composer = !sent ? (
    <ChatComposer>
      {f >= TYPE_AT ? (
        <>
          {typed(TYPED, f, TYPE_AT, 1.1)}
          {f >= INSERT_AT && <Inserted text={MACRO_2} at={INSERT_AT} />}
          <Caret solid={f < TYPE_AT + 50} />
        </>
      ) : undefined}
    </ChatComposer>
  ) : (
    <ChatComposer>
      {f >= FOLLOW_AT ? (
        <>
          {typed(FOLLOW, f, FOLLOW_AT, 1.2)}
          {f >= INSERT2_AT && <Inserted text={MACRO_4} at={INSERT2_AT} />}
          <Caret solid={f < FOLLOW_AT + 42} />
        </>
      ) : undefined}
    </ChatComposer>
  );

  return (
    <Scene
      dur={SCENES.macros}
      captions={[
        { from: 6, to: 80, text: "Halfway through a message? Press {Alt+2}." },
        { from: 88, to: 196, text: "One key, your *favourite prompts*." },
        { from: 212, to: 404, text: "Got a wall of text back? Type your follow-up…" },
        { from: 412, to: 556, text: "…then {Alt+4} asks for a *concise summary*." },
      ]}
    >
      <Camera p={zoom} zoom={1.1} focus={{ x: 1060, y: 600 }} to={{ x: 990, y: 540 }}>
        <Place x={288} y={52} scale={1.4}>
          <ChatWindow
            active={2}
            convos={["Acme landing page fixes", "Auth refactor", "Pricing table"]}
            composer={composer}
            overlay={
              <>
                <StreamingChrome progress={progress} />
                <MacroCard />
              </>
            }
          >
            {/* min-height + bottom anchor: top-aligned while short, scrolls up once the thread outgrows the view */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                minHeight: "100%",
                boxSizing: "border-box",
                padding: "24px 48px 8px",
              }}
            >
              <Bubble from="you">The pricing table is done. What's next?</Bubble>
              <Bubble from="ai">Next up is the billing period switch. Tell me how you want it to behave.</Bubble>
              {sent && (
                <div style={{ opacity: Math.min(1, sentIn), transform: `translateY(${(1 - sentIn) * 24}px)` }}>
                  <Bubble from="you">
                    {TYPED}
                    {MACRO_2}
                  </Bubble>
                </div>
              )}
              {f >= STREAM_AT && <Answer progress={progress} />}
            </div>
          </ChatWindow>
        </Place>
      </Camera>
      <KeyCombo keys={["Alt", "2"]} at={KEY_AT} hold={10} pos="topRight" />
      <KeyCombo keys={["Enter"]} at={SEND_AT} hold={6} pos="topRight" />
      <KeyCombo keys={["Alt", "4"]} at={KEY2_AT} hold={10} pos="topRight" />
      <Sfx at={INSERT_AT} name="sparkle" volume={0.25} />
      <Sfx at={SEND_AT + 2} name="whoosh" volume={0.35} />
      <Sfx at={INSERT2_AT} name="sparkle" volume={0.25} />
    </Scene>
  );
};
