import React from "react";
import { useCurrentFrame } from "remotion";
import { along, pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  Cursor,
  DISPLAY,
  KeyCast,
  Keys,
  L,
  SANS,
  SceneFade,
  Sfx,
  SlideIn,
  Tile,
  Win,
  reveal,
} from "../kit";
import {
  Bubble,
  Composer,
  MACRO_DOES,
  MACRO_FIRST,
  MACROS,
  MacroCard,
  Sidebar,
} from "../pieces";

// Standing orders, v1.0.4. The story: they are your own prompt templates on hotkeys. Five
// starters ship as a workflow (1 Research → 2 Summarize → 3 Plan → 4 Scope → 5 Execute),
// described word for word from the build thread's table; you can rewrite any of them or add
// your own (Settings → Macros: name, hotkey, prompt, insert before, submit). Then one use:
// Alt+4 Scope, Alt+5 Execute. A macro is pasted at the cursor after a leading space.
// VO: 16-orders at 9, 16b-workflow at 210, 17-custom at 429, 17b-use at 660,
// 18-execute at 855, 18b-more at 1020.

// Beat 1: the default workflow
const STEP_AT = [284, 311, 340, 355, 374]; // each step lights as the narration names it
const WORKFLOW_OUT = [420, 432] as const;
// Beat 2: make them yours (Settings → Macros)
const PAGE = 430;
const PICK_SCOPE = 452;
const EDIT = [474, 520] as const; // a line added to Scope's prompt
const NEW = 534; // + New macro
const NAME = [546, 566] as const;
const HOTKEY = 574; // Alt+6 recorded
const PROMPT = [588, 640] as const;
const PAGE_OUT = [652, 664] as const;
// Beat 3: use it
const TYPE1 = [674, 706] as const;
const KEY4 = 714;
const ENTER1 = 746;
const KEY5 = 880;
const ENTER2 = 910;
const MORE = 1020;

const SCOPE_LINES = [
  "Fully scope this so a builder who has never seen this conversation can deliver it without guessing. Investigate the code first and ask me about anything you can't settle yourself. Then write the spec:",
  "- Goal and why it matters. Non-goals: what we are not doing.",
  "- Acceptance criteria: specific and testable, including edge cases and error states.",
];
const SCOPE_EDIT =
  "- Use our existing design tokens: no new colors, fonts or spacing.";
const REVIEW_PROMPT =
  "Review this diff for bugs, security issues and missing tests. List each issue by severity, with the fix.";

type Ln = string;
const SPEC: Ln[] = [
  "**Goal** Sign in with Google, so new users skip the password form.",
  "**Non-goals** No changes to email sign-up. No account linking.",
  "**Acceptance criteria**",
  "  ✓ “Continue with Google” on /login signs the user in",
  "  ✓ Closing the Google popup shows an error, not a blank page",
  "**Constraints** Existing design tokens only. Keep auth/session.ts; don't change the users table.",
  "**Tasks**",
  "  1. OAuth config · auth/google.ts · done when npm test auth passes · parallel",
  "  2. Login button · LoginPage.tsx · done when the screenshot matches · parallel",
  "**Review gates** Tests and build after each task; your OK on a screenshot before ship.",
  "**Risks & assumptions** Assumes one Google project for dev and prod.",
];
const ORCHESTRATE: Ln[] = [
  "Orchestrating 2 builders from the agreed spec.",
  "  ▸ Builder A: auth/google.ts only · criteria 1–2 · must pass npm test auth",
  "  ▸ Builder B: LoginPage.tsx only · criterion 3 · must pass a screenshot review",
  "  No two builders share a file. A and B run in parallel.",
  "  ✓ Fresh reviewer, A: 12 / 12 tests passed (output attached)",
  "  ✓ Fresh reviewer, B: screenshot matches the spec (attached)",
  "**Report** Built: Google sign-in on /login. Evidence for each criterion above. Scope unchanged, nothing open.",
];

/* ------------------------------------------------------------------ beat 1 */

const WorkflowStrip: React.FC = () => {
  const f = useCurrentFrame();
  if (f >= WORKFLOW_OUT[1]) return null;
  const o = ramp(f, 4, 16) * (1 - ramp(f, WORKFLOW_OUT[0], WORKFLOW_OUT[1]));
  const lit = STEP_AT.filter((a) => f >= a).length - 1;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <div
        style={{
          position: "absolute",
          top: 180,
          left: 0,
          right: 0,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: DISPLAY, fontSize: 44, color: L.text }}>
          Your standing orders, out of the box
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 21,
            color: L.muted,
            marginTop: 8,
          }}
        >
          Prompt templates on hotkeys. Edit any of them, or add your own.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "stretch",
          gap: 0,
        }}
      >
        {MACROS.map(([key, name], i) => {
          const p = pop(f, 18 + i * 9);
          const on = i === lit;
          const done = i < lit;
          return (
            <React.Fragment key={key}>
              {i > 0 && (
                <div
                  style={{
                    width: 30,
                    display: "grid",
                    placeItems: "center",
                    color: done || on ? L.bronze2 : L.line2,
                    fontSize: 26,
                    opacity: p,
                  }}
                >
                  →
                </div>
              )}
              <div
                style={{
                  width: 320,
                  padding: "20px 20px 22px",
                  borderRadius: 16,
                  background: on ? `${L.bronze2}1c` : L.card,
                  border: `1px solid ${on ? L.bronze2 : L.line}`,
                  boxShadow: on
                    ? `0 0 34px ${L.bronze}44, 0 24px 60px #000a`
                    : "0 24px 60px #000a",
                  opacity: Math.min(1, p * 1.4),
                  transform: `translateY(${(1 - p) * 40}px) scale(${on ? 1.03 : 1})`,
                  fontFamily: SANS,
                  color: L.text,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      display: "grid",
                      placeItems: "center",
                      background: on || done ? L.red : "#2c221c",
                      border: `1px solid ${L.bronze2}`,
                      fontFamily: DISPLAY,
                      fontSize: 22,
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 32,
                      color: on ? L.bronze2 : L.text,
                    }}
                  >
                    {name}
                  </span>
                </div>
                <Keys combo={key} size={26} lit={on} />
                <div
                  style={{ fontSize: 16, lineHeight: 1.5, color: "#e0d3c0" }}
                >
                  {MACRO_DOES[i]}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ beat 2 */

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
  first?: boolean;
  stacked?: boolean;
}> = ({ label, hint, children, first, stacked }) => (
  <div
    style={{
      display: "flex",
      flexDirection: stacked ? "column" : "row",
      alignItems: stacked ? "stretch" : "center",
      gap: stacked ? 8 : 16,
      padding: "11px 20px",
      borderTop: first ? undefined : `1px solid ${L.line}`,
      fontSize: 17,
    }}
  >
    <div style={{ flex: stacked ? undefined : 1 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 14, color: L.muted, marginTop: 2 }}>{hint}</div>
      )}
    </div>
    {children}
  </div>
);

const Input: React.FC<{ text: string; w?: number; caret?: boolean }> = ({
  text,
  w = 280,
  caret,
}) => (
  <span
    style={{
      width: w,
      border: `1px solid ${caret ? L.bronze2 : L.line2}`,
      borderRadius: 8,
      padding: "6px 10px",
      background: "#150f0c",
      fontSize: 16,
      minHeight: 22,
    }}
  >
    {text}
    {caret && (
      <span
        style={{
          display: "inline-block",
          width: 2,
          height: 18,
          background: L.text,
          verticalAlign: "middle",
        }}
      />
    )}
  </span>
);

const MacrosPage: React.FC = () => {
  const f = useCurrentFrame();
  if (f < PAGE - 2 || f >= PAGE_OUT[1]) return null;
  const o = pop(f, PAGE) * (1 - ramp(f, PAGE_OUT[0], PAGE_OUT[1]));
  const review = f >= NEW;
  const names = [
    ...MACROS.map(([, n]) => n),
    ...(review
      ? [
          f >= NAME[0]
            ? reveal("Code review", f, NAME[0], NAME[1]) || "New macro"
            : "New macro",
        ]
      : []),
  ];
  const selected = review ? names.length - 1 : f >= PICK_SCOPE ? 3 : -1;
  const pos = along(f, [
    [PAGE + 4, 1100, 700],
    [PICK_SCOPE - 4, 966, 350],
    [EDIT[0] - 4, 1300, 640],
    [NEW - 4, 1168, 346],
    [NAME[0] - 4, 1446, 417],
    [HOTKEY - 6, 1520, 467],
    [PROMPT[0] - 4, 1100, 600],
    [PAGE_OUT[0], 1200, 760],
  ]);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Win x={300} y={150} w={1320} h={800} title="Vibius Maximus" kind="vibe">
        <div style={{ display: "flex", height: "100%" }}>
          <Sidebar active="macros" />
          <div
            style={{
              flex: 1,
              padding: "22px 34px",
              fontFamily: SANS,
              color: L.text,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Tile name="macros" size={46} />
              <span style={{ fontFamily: DISPLAY, fontSize: 34 }}>Macros</span>
            </div>
            <div
              style={{
                fontFamily: DISPLAY,
                color: L.bronze2,
                letterSpacing: "0.2em",
                fontSize: 14,
                margin: "16px 0 4px",
              }}
            >
              PROMPT MACROS
            </div>
            <div style={{ fontSize: 14, color: L.muted, marginBottom: 8 }}>
              Press a macro's hotkey anywhere to insert its prompt at your
              cursor.
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                padding: 12,
                border: `1px solid ${L.line}`,
                borderRadius: 12,
                background: L.card,
              }}
            >
              {names.map((n, i) => (
                <span
                  key={i}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 16,
                    background: i === selected ? `${L.bronze2}2b` : "#241b16",
                    border: `1px solid ${i === selected ? L.bronze2 : L.line}`,
                    color: i === selected ? L.bronze2 : L.text,
                  }}
                >
                  {n || "…"}
                </span>
              ))}
              <span
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  fontSize: 16,
                  color: f >= NEW - 10 && f < NEW + 10 ? L.bronze2 : L.muted,
                }}
              >
                + New macro
              </span>
            </div>
            {selected >= 0 && (
              <div
                style={{
                  marginTop: 16,
                  border: `1px solid ${L.line}`,
                  borderRadius: 12,
                  background: L.card,
                }}
              >
                <Field label="Name" first>
                  <Input
                    text={review ? names[names.length - 1] : "Scope"}
                    caret={review && f >= NAME[0] && f < HOTKEY - 6}
                  />
                </Field>
                <Field label="Hotkey">
                  {review && f < HOTKEY ? (
                    <span style={{ fontSize: 15, color: L.bronze2 }}>
                      Press the keys…
                    </span>
                  ) : (
                    <span
                      style={{
                        border: `1px solid ${L.line2}`,
                        background: "#241b16",
                        borderRadius: 7,
                        padding: "4px 11px",
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      {review ? "Alt + 6" : "Alt + 4"}
                    </span>
                  )}
                </Field>
                <Field
                  label="Prompt"
                  hint="Hold Ctrl+Space to dictate. Variables: {clipboard}, {date}, {time}"
                  stacked
                >
                  <div
                    style={{
                      border: `1px solid ${(f >= EDIT[0] && f < NEW) || (review && f >= PROMPT[0]) ? L.bronze2 : L.line2}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      background: "#150f0c",
                      fontSize: 15,
                      lineHeight: 1.5,
                      height: 150,
                      overflow: "hidden",
                    }}
                  >
                    {review ? (
                      <div>
                        {f >= PROMPT[0]
                          ? reveal(REVIEW_PROMPT, f, PROMPT[0], PROMPT[1])
                          : ""}
                      </div>
                    ) : (
                      <>
                        {SCOPE_LINES.map((l) => (
                          <div key={l}>{l}</div>
                        ))}
                        {f >= EDIT[0] && (
                          <div
                            style={{
                              background: `${L.bronze}38`,
                              color: "#fff3df",
                              borderRadius: 4,
                            }}
                          >
                            {reveal(SCOPE_EDIT, f, EDIT[0], EDIT[1])}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </Field>
                <Field label="Insert before">
                  <Input text="Space ▾" w={120} />
                </Field>
                <Field label="Press submit after inserting">
                  <span
                    style={{
                      width: 50,
                      height: 28,
                      borderRadius: 14,
                      background: "#3a302a",
                      position: "relative",
                      display: "inline-block",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 4,
                        left: 4,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: "#fff",
                      }}
                    />
                  </span>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Win>
      <Cursor
        x={pos.x}
        y={pos.y}
        clicks={[
          PICK_SCOPE,
          EDIT[0] - 2,
          NEW,
          NAME[0] - 2,
          HOTKEY - 8,
          PROMPT[0] - 2,
        ]}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ beat 3 */

const Line: React.FC<{ text: Ln; at: number }> = ({ text, at }) => {
  const f = useCurrentFrame();
  if (f < at) return null;
  const o = ramp(f, at, at + 6);
  const m = text.match(/^\*\*(.+?)\*\*\s?(.*)$/);
  return (
    <div style={{ opacity: o, whiteSpace: "pre-wrap" }}>
      {m ? (
        <>
          <b style={{ color: "#fff" }}>{m[1]}</b> {m[2]}
        </>
      ) : (
        <span style={{ color: text.includes("✓") ? "#9be3a7" : undefined }}>
          {text}
        </span>
      )}
    </div>
  );
};

const Reply: React.FC<{ lines: Ln[]; from: number; step?: number }> = ({
  lines,
  from,
  step = 10,
}) => (
  <div
    style={{
      padding: "12px 40px 0",
      fontSize: 17,
      lineHeight: 1.5,
      color: "#d6d6da",
    }}
  >
    {lines.map((l, i) => (
      <Line key={i} text={l} at={from + i * step} />
    ))}
  </div>
);

const Sent: React.FC<{ ask?: string; macro: string }> = ({ ask, macro }) => (
  <Bubble me w={920} size={17}>
    {ask}
    {ask ? " " : ""}
    <span
      style={{ background: `${L.bronze}38`, borderRadius: 4, color: "#fff3df" }}
    >
      {macro} …
    </span>
  </Bubble>
);

const Conversation: React.FC = () => {
  const f = useCurrentFrame();
  let body: React.ReactNode = null;
  let composer: { text: string; insert?: string; flashAt?: number } = {
    text: "",
  };
  const ASK = "Add Google sign-in to our app.";
  if (f < ENTER1) {
    composer = {
      text: reveal(ASK, f, TYPE1[0], TYPE1[1]),
      insert: f >= KEY4 + 6 ? ` ${MACRO_FIRST.scope} …` : undefined,
      flashAt: KEY4 + 6,
    };
  } else if (f < ENTER2) {
    body = (
      <>
        <Sent ask={ASK} macro={MACRO_FIRST.scope} />
        <Reply lines={SPEC} from={ENTER1 + 12} step={9} />
      </>
    );
    composer = {
      text: "",
      insert: f >= KEY5 + 6 ? ` ${MACRO_FIRST.execute} …` : undefined,
      flashAt: KEY5 + 6,
    };
  } else {
    body = (
      <>
        <div style={{ padding: "12px 40px 0", fontSize: 16, color: "#8a8a90" }}>
          ↑ Spec: Google sign-in (goal, non-goals, criteria, constraints, tasks,
          gates, risks)
        </div>
        <Sent macro={MACRO_FIRST.execute} />
        <Reply lines={ORCHESTRATE} from={ENTER2 + 12} step={14} />
      </>
    );
  }
  const flash =
    composer.flashAt !== undefined && f >= composer.flashAt
      ? 1 - ramp(f, composer.flashAt, composer.flashAt + 30)
      : 0;
  const quiet = f >= ENTER2;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {body}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
        <Composer
          h={quiet ? 70 : 120}
          text={composer.text}
          insert={composer.insert}
          flash={flash}
          caret={!quiet}
        />
      </div>
    </div>
  );
};

export const S6Macros: React.FC = () => {
  const f = useCurrentFrame();
  const use = f >= PAGE_OUT[0];
  const lit =
    f >= KEY5 && f < ENTER2 + 90 ? 4 : f >= KEY4 && f < KEY5 ? 3 : null;
  const glowNew = f >= MORE + 10 ? 0.5 + 0.5 * Math.sin((f - MORE) / 8) : 0;
  return (
    <SceneFade>
      <Backdrop>
        <WorkflowStrip />
        <MacrosPage />
        {use && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: ramp(f, PAGE_OUT[0], PAGE_OUT[1] + 6),
            }}
          >
            <SlideIn at={PAGE_OUT[0]} dy={30}>
              <Win x={90} y={190} w={1110} h={730} title="Chat — Google Chrome">
                <Conversation />
              </Win>
            </SlideIn>
            <SlideIn at={PAGE_OUT[0] + 8} dx={60} dy={0}>
              <MacroCard
                lit={lit}
                glowNew={glowNew}
                extra={["Alt+6", "Code review"]}
              />
            </SlideIn>
          </div>
        )}
        <Chip n={6} titles={[[0, "Standing orders"]]} />
        <KeyCast
          presses={[
            { combo: "Alt+6", at: HOTKEY - 4 },
            { combo: "Alt+4", at: KEY4 },
            { combo: "Enter", at: ENTER1 },
            { combo: "Alt+5", at: KEY5 },
            { combo: "Enter", at: ENTER2 },
          ]}
        />
        {STEP_AT.map((a) => (
          <Sfx key={a} at={a} name="shield" volume={0.22} />
        ))}
        {[KEY4, KEY5].map((k) => (
          <Sfx key={k} at={k + 6} name="scroll" volume={0.4} />
        ))}
        {[ENTER1, ENTER2].map((k) => (
          <Sfx key={k} at={k + 2} name="whoosh" volume={0.22} />
        ))}
        <Captions
          items={[
            {
              from: 8,
              to: 205,
              text: "Standing orders: your own *prompt templates*, on hotkeys.",
            },
            {
              from: 210,
              to: 420,
              text: "{Alt+1} to {Alt+5} runs the whole *campaign*: research, summarize, plan, scope, execute.",
            },
            {
              from: 429,
              to: 655,
              text: "Rewrite any of them, or add your own: *Code review* on {Alt+6}.",
            },
            {
              from: 660,
              to: 850,
              text: "Then fire it anywhere: type the ask, {Alt+4}, a full *spec* comes back.",
            },
            {
              from: 855,
              to: 1015,
              text: "{Alt+5} hands it to *builder agents*; a reviewer checks the evidence.",
            },
            {
              from: MORE,
              to: 1165,
              text: "Five to start. *As many as you need.*",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
