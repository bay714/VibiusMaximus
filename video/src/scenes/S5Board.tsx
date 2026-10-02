import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { along, bouncy, pop, ramp, typed } from "../anim";
import { AcmeThumb } from "../components/AcmePage";
import { Caret, ChatComposer, ChatWindow } from "../components/ChatWindow";
import { Cursor } from "../components/Cursor";
import { Kbd, KeyCombo } from "../components/Keycap";
import { Label, OptionTile, type OptionVariant } from "../components/OptionTile";
import { PinBadge } from "../components/Pin";
import { Sfx } from "../components/Sfx";
import { Place, Scene } from "../components/Stage";
import { Toast } from "../components/Toast";
import { Window } from "../components/Window";
import { Wordmark } from "../components/Wordmark";
import { C } from "../theme";
import { SCENES } from "../timeline";

const OPEN_KEY = 8;
const OPEN = 16;
const CURRENT_AT = 30;
const DROP = 60;
const PREFER_AT = 112;
const SEND_KEY = 196;
const OUT = 208;
const ATTACH_AT = 226;
const TEXT_AT = 252;

const OPTIONS: { v: OptionVariant; note: string }[] = [
  { v: "A", note: "Centered, keeps the current layout." },
  { v: "B", note: "Split layout, product shot on the right." },
  { v: "C", note: "Dark theme." },
  { v: "D", note: "Full-width image on top." },
  { v: "E", note: "Minimal, no illustration." },
];
const PREFER = "Prefer B with C's colours.";
const PROMPT = "Redesign the landing hero. Use the current page for structure and pick the best option.";

const Btn: React.FC<{ children: React.ReactNode; primary?: boolean; glow?: number }> = ({ children, primary, glow = 0 }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 12px",
      borderRadius: 8,
      fontSize: 13.5,
      whiteSpace: "nowrap",
      background: primary ? C.accent : C.panel,
      border: `1px solid ${primary ? C.accent : C.line}`,
      color: primary ? "#fff" : C.text,
      fontWeight: primary ? 600 : 400,
      boxShadow: glow ? `0 0 ${26 * glow}px ${C.accent}` : "none",
      transform: `scale(${1 - 0.04 * glow})`,
    }}
  >
    {children}
  </div>
);

const Section: React.FC<{ title: string; badge: string; right?: React.ReactNode; children: React.ReactNode; highlight?: number }> = ({
  title,
  badge,
  right,
  children,
  highlight = 0,
}) => (
  <div
    style={{
      marginTop: 12,
      borderRadius: 12,
      background: C.panel,
      border: `1px solid ${highlight ? `rgba(139,92,246,${0.3 + 0.7 * highlight})` : C.line}`,
      boxShadow: highlight ? `inset 0 0 0 1px rgba(139,92,246,${0.5 * highlight})` : "none",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderBottom: `1px solid ${C.line}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.muted, letterSpacing: -2 }}>⋮⋮</span>
      <b style={{ fontSize: 14 }}>{title}</b>
      <Label text={badge} />
      <span style={{ marginLeft: "auto", color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>{right}</span>
    </div>
    <div style={{ padding: 14 }}>{children}</div>
  </div>
);

const TextBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      border: `1px solid ${C.line}`,
      borderRadius: 8,
      background: C.bg,
      padding: "9px 12px",
      fontSize: 14,
      minHeight: 20,
    }}
  >
    {children}
  </div>
);

const BoardWindow: React.FC = () => {
  const f = useCurrentFrame();
  const cur = pop(f, CURRENT_AT, { damping: 18, stiffness: 140 });
  const dropZone = Math.min(ramp(f, DROP - 18, DROP - 8), 1 - ramp(f, DROP + 30, DROP + 40));
  const prefer = typed(PREFER, f, PREFER_AT, 1);
  const pickB = ramp(f, PREFER_AT + 14, PREFER_AT + 22);
  const glow = interpolate(f, [SEND_KEY, SEND_KEY + 4, SEND_KEY + 14], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drag = along(f, [
    [DROP - 26, 1300, 430],
    [DROP - 6, 760, 470],
    [DROP + 4, 760, 470],
    [DROP + 20, 1280, 520],
  ]);
  const dragOn = f >= DROP - 26 && f < DROP + 20;

  return (
    <Window
      x={0}
      y={0}
      w={1240}
      h={720}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Wordmark size={13} /> <span>— Board</span>
        </span>
      }
    >
      <div style={{ padding: "14px 20px", fontSize: 14 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Btn>
            + Capture <Kbd keys="Alt+Shift+S" size={17} />
          </Btn>
          <Btn>+ Add files</Btn>
          <Btn>
            Paste image <Kbd keys="Ctrl+V" size={17} />
          </Btn>
          <Btn>New section</Btn>
          <div style={{ marginLeft: "auto" }} />
          <Btn>Onboarding hero redesign ▾</Btn>
          <Btn>
            ✨ Clean up <Kbd keys="Ctrl+K" size={17} />
          </Btn>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 12,
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 12,
            background: C.panel,
            border: `1px solid ${C.line}`,
          }}
        >
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.panel2, display: "grid", placeItems: "center", color: C.muted }}>
            🎙
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: C.muted, letterSpacing: ".08em" }}>PROMPT</div>
            <div style={{ fontSize: 14.5 }}>{PROMPT} Implement it with our Next.js + Tailwind setup.</div>
          </div>
        </div>

        <Section title="Current" badge="Image 1" right="from capture · 2 pins">
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", height: 128 }}>
            <div style={{ opacity: Math.min(1, cur), transform: `translateX(${(1 - cur) * -30}px)` }}>
              <AcmeThumb width={256} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, opacity: cur }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <PinBadge n={1} /> Headline is too big on mobile.
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <PinBadge n={2} /> Input and button heights don't match.
              </div>
              <TextBox>
                <span style={{ color: C.muted }}>
                  Section text… <Kbd keys="Ctrl+Space" size={17} /> to dictate
                </span>
              </TextBox>
            </div>
          </div>
        </Section>

        <Section
          title="Options"
          badge="Images 2–6"
          highlight={dropZone}
          right={
            <>
              Drop images here or <Kbd keys="Ctrl+V" size={17} />
            </>
          }
        >
          <div style={{ display: "flex", gap: 18, height: 178 }}>
            {OPTIONS.map((o, i) => {
              const s = bouncy(f, DROP + i * 6);
              const note = ramp(f, DROP + i * 6 + 6, DROP + i * 6 + 14);
              return (
                <div
                  key={o.v}
                  style={{
                    width: 212,
                    opacity: Math.min(1, s * 1.5),
                    transform: `translateY(${(1 - s) * -46}px) scale(${0.9 + 0.1 * s})`,
                  }}
                >
                  <OptionTile variant={o.v} w={212} h={128} label={`${i + 2} · ${o.v}`} selected={o.v === "B" ? pickB : 0} />
                  <div style={{ marginTop: 7, fontSize: 12.5, color: C.muted, lineHeight: 1.35, opacity: note }}>{o.note}</div>
                </div>
              );
            })}
          </div>
          <TextBox>
            {prefer ? (
              <>
                {prefer}
                <Caret height={16} solid={f < PREFER_AT + PREFER.length + 4} />
              </>
            ) : (
              <span style={{ color: C.muted }}>Notes for this section…</span>
            )}
          </TextBox>
        </Section>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
          <span style={{ color: C.muted, fontSize: 13 }}>
            {f >= DROP + 24 ? "6 images" : "1 image"} · autosaved
          </span>
          <div style={{ marginLeft: "auto" }} />
          <Btn>
            Copy text <Kbd keys="Ctrl+Alt+C" size={16} />
          </Btn>
          <Btn>
            Copy as one image <Kbd keys="Ctrl+Shift+C" size={16} />
          </Btn>
          <Btn primary glow={glow}>
            Send to AI Chat ▾ <span style={{ color: "#ede9fe", fontSize: 12 }}>Ctrl+Enter</span>
          </Btn>
        </div>
      </div>

      {dragOn && (
        <div style={{ position: "absolute", left: drag.x, top: drag.y, opacity: 1 - ramp(f, DROP + 2, DROP + 8) }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: 14 + i * 6,
                top: 10 + i * 6,
                width: 78,
                height: 52,
                borderRadius: 6,
                background: ["#fff", "#111827", "#fde68a"][i],
                border: "1px solid #ffffff44",
                boxShadow: "0 6px 16px #0008",
                transform: `rotate(${(i - 1) * 5}deg)`,
              }}
            />
          ))}
          <div style={{ position: "absolute", left: 40, top: 70, padding: "3px 8px", borderRadius: 6, background: C.accent, color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            + 5 files
          </div>
        </div>
      )}
      {dragOn && <Cursor x={drag.x} y={drag.y} />}
    </Window>
  );
};

const OUTPUT: { tag?: number; text: string }[] = [
  { text: PROMPT },
  { tag: 1, text: "Current: headline too big on mobile; input and button heights don't match." },
  ...OPTIONS.map((o, i) => ({ tag: i + 2, text: `Option ${o.v}: ${o.note.charAt(0).toLowerCase()}${o.note.slice(1)}` })),
  { text: PREFER },
];

const Tag: React.FC<{ n: number }> = ({ n }) => (
  <span
    style={{
      display: "inline-block",
      padding: "0 6px",
      marginRight: 6,
      borderRadius: 5,
      background: "#8b5cf62e",
      border: "1px solid #8b5cf666",
      color: "#ddd6fe",
      fontWeight: 600,
      fontSize: 13.5,
    }}
  >
    [Image {n}]
  </span>
);

const ChatOutput: React.FC = () => {
  const f = useCurrentFrame();
  const thumbs = [
    <AcmeThumb key="cur" width={92} pins={false} />,
    ...OPTIONS.map((o) => <OptionTile key={o.v} variant={o.v} w={92} h={58} />),
  ];
  return (
    <ChatWindow
      convos={["Hero redesign", "Acme landing page fixes", "Auth refactor"]}
      composer={
        <ChatComposer
          attachments={
            f >= ATTACH_AT
              ? thumbs.map((t, i) => {
                  const s = bouncy(f, ATTACH_AT + i * 4);
                  return (
                    <div key={i} style={{ position: "relative", height: 58, display: "flex", alignItems: "center", opacity: Math.min(1, s * 1.5), transform: `scale(${s})` }}>
                      {t}
                      <div style={{ position: "absolute", left: 4, top: 4 }}>
                        <Label text={`${i + 1}`} size={10} />
                      </div>
                    </div>
                  );
                })
              : undefined
          }
        >
          {f >= TEXT_AT
            ? OUTPUT.map((l, i) => (
                <div key={i} style={{ opacity: ramp(f, TEXT_AT + i * 2, TEXT_AT + i * 2 + 6), marginBottom: i === 0 ? 6 : 0 }}>
                  {l.tag !== undefined && <Tag n={l.tag} />}
                  {l.text}
                  {i === OUTPUT.length - 1 && <Caret />}
                </div>
              ))
            : undefined}
        </ChatComposer>
      }
      overlay={<Toast at={TEXT_AT + 20} right={24} top={64} text="Pasted 6 images + text · clipboard restored" />}
    />
  );
};

/** 40–52 s: Alt+Shift+B board with Current + options A–E → Ctrl+Enter → 6 labelled images in chat. */
export const S5Board: React.FC = () => {
  const f = useCurrentFrame();
  const open = pop(f, OPEN, { damping: 20, stiffness: 140 });
  const out = ramp(f, OUT, OUT + 14);
  const chat = pop(f, OUT + 8, { damping: 200, stiffness: 120 });

  return (
    <Scene
      dur={SCENES.board}
      captions={[
        { from: 6, to: 184, text: "{Alt+Shift+B}: a board for screenshots, design options and notes." },
        { from: 192, to: 350, text: "{Ctrl+Enter} sends all six images, labelled to match the prompt." },
      ]}
    >
      {f >= OPEN && out < 1 && (
        <AbsoluteFill style={{ opacity: Math.min(1, open) * (1 - out), transform: `scale(${(0.95 + 0.05 * open) * (1 - 0.03 * out)})` }}>
          <Place x={303} y={160} scale={1.06}>
            <BoardWindow />
          </Place>
        </AbsoluteFill>
      )}
      {f >= OUT + 8 && (
        <AbsoluteFill style={{ opacity: Math.min(1, chat), transform: `scale(${0.97 + 0.03 * chat})` }}>
          <Place x={288} y={52} scale={1.4}>
            <ChatOutput />
          </Place>
        </AbsoluteFill>
      )}
      <KeyCombo keys={["Alt", "Shift", "B"]} at={OPEN_KEY} hold={14} />
      <Sfx at={OPEN} name="whoosh" volume={0.35} />
      <Sfx at={CURRENT_AT} name="drop" volume={0.25} />
      {OPTIONS.map((o, i) => (
        <Sfx key={o.v} at={DROP + i * 6} name="drop" volume={0.22} />
      ))}
      <Sfx at={OUT} name="whoosh" volume={0.35} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Sfx key={i} at={ATTACH_AT + i * 4} name="pop" volume={0.14} />
      ))}
      <Sfx at={TEXT_AT + 20} name="chime" volume={0.3} />
      <KeyCombo keys={["Ctrl", "Enter"]} at={SEND_KEY} hold={10} />
    </Scene>
  );
};
