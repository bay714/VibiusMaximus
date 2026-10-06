import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../../anim";
import {
  Backdrop,
  Captions,
  Chip,
  DISPLAY,
  Icon,
  Keys,
  L,
  SANS,
  SceneFade,
  ShieldMark,
  Sfx,
  Tile,
} from "../kit";

// VO (scene-relative): "what" at 12, "how" at 219, "why" at 435.
const VIBE = [20, 205] as const; // the "vibe coding" explainer, before the cards
const CARDS = [225, 290, 362];
const FLOW = 439;
// VO "allies" at 564: "Built on open source: Handy, Excalidraw and xcap."
const ALLIES = 560;
const ALLY_AT = [608, 630, 656];

const PILLARS = [
  {
    icon: "models",
    title: "Speak",
    line: "Offline speech-to-text, straight into any app.",
    keys: ["Ctrl+Space"],
  },
  {
    icon: "capture",
    title: "Show",
    line: "Freeze the screen, mark it up, send it with numbered notes.",
    keys: ["Alt+S", "Alt+B"],
  },
  {
    icon: "macros",
    title: "Standing orders",
    line: "Your best prompts, one key each.",
    keys: ["Alt+1", "Alt+5"],
  },
] as const;

const TARGETS = ["Chat apps", "Claude Code", "Any terminal"];

/** "You describe it, AI builds it": a speech bubble, an arrow, a code glyph. */
const VibeCoding: React.FC = () => {
  const f = useCurrentFrame();
  const o =
    ramp(f, VIBE[0], VIBE[0] + 14) * (1 - ramp(f, VIBE[1], VIBE[1] + 12));
  if (o <= 0) return null;
  const arrow = ramp(f, VIBE[0] + 30, VIBE[0] + 60);
  const code = pop(f, VIBE[0] + 58);
  const glyph: React.CSSProperties = {
    width: 190,
    height: 150,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    background: L.card2,
    border: `1px solid ${L.line}`,
    boxShadow: "0 20px 50px #0008",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 330,
        opacity: o,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 46,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={glyph}>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 22,
              color: L.text,
              padding: "0 18px",
              textAlign: "center",
              lineHeight: 1.35,
            }}
          >
            “Make the
            <br />
            button bronze”
          </div>
        </div>
        <svg width={220} height={40}>
          <line
            x1={10}
            y1={20}
            x2={10 + 190 * arrow}
            y2={20}
            stroke={L.bronze2}
            strokeWidth={4}
            strokeDasharray="4 12"
            strokeLinecap="round"
          />
          {arrow > 0.95 && (
            <path
              d="M 192 8 L 210 20 L 192 32"
              fill="none"
              stroke={L.bronze2}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div
          style={{
            ...glyph,
            opacity: code,
            transform: `scale(${0.8 + 0.2 * code})`,
          }}
        >
          <span
            style={{
              fontFamily: '"Cascadia Mono", Consolas, monospace',
              fontSize: 64,
              color: L.bronze2,
            }}
          >
            {"</>"}
          </span>
        </div>
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 36,
          color: L.text,
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ color: L.bronze2 }}>Vibe coding:</span> you describe it,
        AI builds it.
      </div>
    </div>
  );
};

const PillarCard: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const at = CARDS[i];
  if (f < at) return null;
  const p = pop(f, at, { damping: 16, stiffness: 160 });
  const glow = 1 - ramp(f, at, at + 40);
  const c = PILLARS[i];
  return (
    <div
      style={{
        width: 470,
        padding: "34px 34px 30px",
        borderRadius: 20,
        background: L.card,
        border: `1px solid ${glow > 0.05 ? L.bronze2 : L.line}`,
        boxShadow: `0 30px 70px #000a, 0 0 ${50 * glow}px ${L.bronze}55`,
        opacity: Math.min(1, p * 1.4),
        transform: `translateY(${(1 - p) * 50}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        fontFamily: SANS,
      }}
    >
      <Tile name={c.icon} size={72} />
      <div style={{ fontFamily: DISPLAY, fontSize: 46, color: L.text }}>
        {c.title}
      </div>
      <div
        style={{
          fontSize: 24,
          lineHeight: 1.4,
          color: "#d9ccb9",
          minHeight: 68,
        }}
      >
        {c.line}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: L.muted,
          fontSize: 20,
        }}
      >
        {c.keys.map((k, j) => (
          <React.Fragment key={k}>
            {j > 0 && <span>{i === 2 ? "…" : "·"}</span>}
            <Keys combo={k} size={34} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/** You → Vibius Maximus → your AI tools: the legion. */
const Flow: React.FC = () => {
  const f = useCurrentFrame();
  if (f < FLOW) return null;
  const p = pop(f, FLOW);
  const line = ramp(f, FLOW + 4, FLOW + 30);
  const chip: React.CSSProperties = {
    fontFamily: SANS,
    fontSize: 22,
    color: L.text,
    background: L.card2,
    border: `1px solid ${L.line}`,
    borderRadius: 999,
    padding: "8px 18px",
    whiteSpace: "nowrap",
  };
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 800,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 22,
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      <span
        style={{
          ...chip,
          background: "transparent",
          border: `1px solid ${L.bronze}88`,
          fontFamily: DISPLAY,
          fontSize: 26,
        }}
      >
        You
      </span>
      <span style={{ color: L.bronze2, fontSize: 30, opacity: line }}>→</span>
      <ShieldMark size={54} />
      <span style={{ color: L.bronze2, fontSize: 30, opacity: line }}>→</span>
      {TARGETS.map((t, i) => (
        <span
          key={t}
          style={{
            ...chip,
            opacity: ramp(f, FLOW + 10 + i * 6, FLOW + 18 + i * 6),
          }}
        >
          {t}
        </span>
      ))}
      <span
        style={{
          fontFamily: DISPLAY,
          fontSize: 26,
          color: L.bronze2,
          marginLeft: 8,
          opacity: ramp(f, FLOW + 30, FLOW + 40),
        }}
      >
        your legion
      </span>
    </div>
  );
};

// The open-source projects Vibius Maximus is built on (README, docs/PLAN.md, Cargo.toml,
// package.json). Names only, no logos.
const ALLY_LIST = [
  {
    name: "Handy",
    repo: "github.com/cjpais/Handy",
    role: "Speech-to-text. The app is a fork of it.",
    icon: "models",
  },
  {
    name: "Excalidraw",
    repo: "github.com/excalidraw/excalidraw",
    role: "The drawing canvas.",
    icon: "postprocess",
  },
  {
    name: "xcap",
    repo: "github.com/nashaofu/xcap",
    role: "Screen capture.",
    icon: "capture",
  },
] as const;

/** "Built on open source": one card per project, each landing as the narration names it. */
const Allies: React.FC = () => {
  const f = useCurrentFrame();
  if (f < ALLIES) return null;
  const title = ramp(f, ALLIES, ALLIES + 14);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 372,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 34,
      }}
    >
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 22,
          color: L.bronze2,
          letterSpacing: "0.32em",
          opacity: title,
        }}
      >
        BUILT ON OPEN SOURCE
      </div>
      <div style={{ display: "flex", gap: 40 }}>
        {ALLY_LIST.map((a, i) => {
          const at = ALLY_AT[i];
          if (f < at) return <div key={a.name} style={{ width: 470 }} />;
          const p = pop(f, at, { damping: 16, stiffness: 160 });
          const glow = 1 - ramp(f, at, at + 40);
          return (
            <div
              key={a.name}
              style={{
                width: 470,
                padding: "30px 32px 28px",
                borderRadius: 20,
                background: L.card,
                border: `1px solid ${glow > 0.05 ? L.bronze2 : L.line}`,
                boxShadow: `0 30px 70px #000a, 0 0 ${50 * glow}px ${L.bronze}55`,
                opacity: Math.min(1, p * 1.4),
                transform: `translateY(${(1 - p) * 50}px)`,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                fontFamily: SANS,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Tile name={a.icon} size={60} />
                <div>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 44,
                      color: L.text,
                      lineHeight: 1.1,
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontFamily: '"Cascadia Mono", Consolas, monospace',
                      fontSize: 17,
                      color: L.bronze2,
                    }}
                  >
                    {a.repo}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 23, lineHeight: 1.4, color: "#d9ccb9" }}>
                {a.role}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SBriefing: React.FC = () => {
  const f = useCurrentFrame();
  const head = ramp(f, 8, 24);
  return (
    <SceneFade>
      <Backdrop>
        <Chip n={0} kicker="THE BRIEFING" titles={[[0, "Your command post"]]} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 190,
            textAlign: "center",
            opacity: head,
          }}
        >
          <div style={{ fontFamily: DISPLAY, fontSize: 64, color: L.text }}>
            Vibius Maximus, for{" "}
            <span style={{ color: L.bronze2 }}>vibe coding</span>
          </div>
          <div
            style={{
              fontFamily: SANS,
              fontSize: 24,
              color: L.muted,
              marginTop: 10,
              display: "flex",
              justifyContent: "center",
              gap: 14,
              alignItems: "center",
            }}
          >
            <Icon name="general" size={22} /> Windows · offline · open source
          </div>
        </div>
        <VibeCoding />
        {/* the three pillars and the flow give way to the allies */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 1 - ramp(f, ALLIES - 14, ALLIES),
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 340,
              display: "flex",
              justifyContent: "center",
              gap: 40,
            }}
          >
            {[0, 1, 2].map((i) => (
              <PillarCard key={i} i={i} />
            ))}
          </div>
          <Flow />
        </div>
        <Allies />
        {CARDS.map((a) => (
          <Sfx key={a} at={a} name="shield" volume={0.35} />
        ))}
        <Sfx at={FLOW} name="whoosh" volume={0.3} />
        {ALLY_AT.map((a) => (
          <Sfx key={a} at={a} name="shield" volume={0.3} />
        ))}
        <Captions
          items={[
            {
              from: 217,
              to: 430,
              text: "*Speak* it. *Show* it. Fire *standing orders*.",
            },
            {
              from: 437,
              to: ALLIES - 12,
              text: "Clearer orders, so your legion builds what you *mean*.",
            },
            {
              from: ALLIES + 4,
              to: 700,
              text: "Built on open source: *Handy*, *Excalidraw* and *xcap*.",
            },
          ]}
        />
      </Backdrop>
    </SceneFade>
  );
};
