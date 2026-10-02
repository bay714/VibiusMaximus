import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../anim";
import { C, FONT } from "../theme";
import { Keycap } from "./Keycap";

/**
 * Renders caption text with two bits of markup:
 *   {Ctrl+Space} → inline keycaps     *word* → violet emphasis
 */
export const RichText: React.FC<{ text: string; keySize: number }> = ({ text, keySize }) => (
  <>
    {text
      .split(/(\{[^}]+\}|\*[^*]+\*)/g)
      .filter(Boolean)
      .map((part, i) => {
        if (part.startsWith("{")) {
          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                gap: keySize * 0.16,
                margin: `0 ${keySize * 0.12}px`,
                verticalAlign: "middle",
                transform: `translateY(${-keySize * 0.08}px)`,
              }}
            >
              {part
                .slice(1, -1)
                .split("+")
                .map((k, j) => (
                  <Keycap key={j} label={k} size={keySize} />
                ))}
            </span>
          );
        }
        if (part.startsWith("*")) {
          return (
            <span key={i} style={{ color: C.accent2 }}>
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
  </>
);

export type Cap = { from: number; to: number; text: string };

/** Bottom-centre caption pill. Captions in one scene should not overlap in time. */
export const Captions: React.FC<{ items: Cap[] }> = ({ items }) => {
  const f = useCurrentFrame();
  return (
    <>
      {items.map((c, i) => {
        if (f < c.from || f > c.to + 10) return null;
        const enter = pop(f, c.from, { damping: 200, stiffness: 140 });
        const exit = ramp(f, c.to, c.to + 10);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 46,
              transform: `translateX(-50%) translateY(${(1 - enter) * 22}px)`,
              opacity: enter * (1 - exit),
              maxWidth: 1700,
              padding: "20px 38px 22px",
              borderRadius: 22,
              background: "rgba(16,18,24,0.94)",
              border: `1px solid ${C.line}`,
              boxShadow: "0 20px 50px #000b",
              color: C.text,
              fontFamily: FONT,
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              textAlign: "center",
            }}
          >
            <RichText text={c.text} keySize={44} />
          </div>
        );
      })}
    </>
  );
};
