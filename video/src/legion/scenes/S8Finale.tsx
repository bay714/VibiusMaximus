import React from "react";
import { useCurrentFrame } from "remotion";
import { pop, ramp } from "../../anim";
import {
  Backdrop,
  L,
  SANS,
  SceneFade,
  Sfx,
  ShieldMark,
  Tile,
  Wordmark,
} from "../kit";
import { Tagline } from "./S0Open";

// Facts as measured on v1.0.3: offline after the one-time model download, the model unloads
// when idle, and the installer is 18 MB (not code-signed; updates are signed).
const FACTS = [
  ["models", "Offline speech"],
  ["history", "Sleeps when idle"],
  ["captures", "18 MB installer"],
] as const;

const STAMPS: [number, number, number] = [128, 143, 158];

export const S8Finale: React.FC = () => {
  const f = useCurrentFrame();
  const logo = pop(f, 0, { damping: 18, stiffness: 120 });
  const url = ramp(f, 178, 192);
  return (
    <SceneFade inFrames={6} outFrames={36}>
      <Backdrop>
        <Sfx at={0} name="drum" volume={0.6} />
        {STAMPS.map((a) => (
          <Sfx key={a} at={a - 2} name="stamp" volume={0.55} />
        ))}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 30,
              opacity: logo,
              transform: `scale(${0.85 + 0.15 * logo})`,
            }}
          >
            <ShieldMark
              size={170}
              style={{ filter: `drop-shadow(0 0 ${50 * logo}px ${L.red}66)` }}
            />
            <Wordmark size={64} stacked />
          </div>
          <div
            style={{
              height: 120,
              display: "flex",
              alignItems: "center",
              marginTop: 30,
            }}
          >
            <Tagline at={STAMPS} size={84} />
          </div>
          <div style={{ display: "flex", gap: 70, marginTop: 30 }}>
            {FACTS.map(([icon, label], i) => {
              const p = pop(f, 22 + i * 10);
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    fontSize: 26,
                    color: L.text,
                    fontFamily: SANS,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 20}px)`,
                  }}
                >
                  <Tile name={icon} size={46} />
                  {label}
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 56,
              fontSize: 26,
              color: L.muted,
              letterSpacing: "0.04em",
              fontFamily: SANS,
              opacity: url,
            }}
          >
            github.com/bay714/VibiusMaximus
          </div>
        </div>
      </Backdrop>
    </SceneFade>
  );
};
