import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { along, easeInOut, pop, ramp, typed, type Keyframe } from "../../anim";
import { AcmePage, BOX, CLEAN, NOTES, PINS, RAMBLE, SEL, SketchBox } from "../../components/AcmePage";
import { Cursor } from "../../components/Cursor";
import { Kbd } from "../../components/Keycap";
import { Pin, PinBadge } from "../../components/Pin";
import { Selection } from "../../components/Selection";
import { Camera, Place } from "../../components/Stage";
import { Waveform } from "../../components/Waveform";
import { Window } from "../../components/Window";
import { C } from "../../theme";

/** Frame cues for the capture scene (scene-local frames). */
export const T = {
  combo: 18,
  freeze: 26,
  dragStart: 58,
  dragEnd: 96,
  editorIn: 100,
  zoom: [104, 142] as const,
  boxKey: 140,
  boxStart: 148,
  boxEnd: 168,
  pinKey: 178,
  pins: [194, 236, 276],
  capStart: 318,
  capEnd: 394,
  cleanKey: 408,
  cleanAt: 418,
};

/** Browser window placement on the 1080p frame. */
const STAGE = { x: 288, y: 60, s: 1.4 };
/** Selection in browser-window coordinates (the page starts 36px down, under the address bar). */
const S = { x: SEL.x, y: SEL.y + 36, w: SEL.w, h: SEL.h };

const CURSOR: Keyframe[] = [
  [0, 700, 340],
  [34, 700, 340],
  [56, S.x, S.y],
  [T.dragStart, S.x, S.y],
  [T.dragEnd, S.x + S.w, S.y + S.h],
  [104, S.x + S.w, S.y + S.h],
  [142, S.x + BOX.x, S.y + BOX.y],
  [T.boxStart, S.x + BOX.x, S.y + BOX.y],
  [T.boxEnd, S.x + BOX.x + BOX.w, S.y + BOX.y + BOX.h],
  [176, S.x + BOX.x + BOX.w, S.y + BOX.y + BOX.h],
  ...PINS.flatMap((p, i): Keyframe[] => [
    [T.pins[i] - 2, S.x + p.x, S.y + p.y],
    [T.pins[i] + 26, S.x + p.x, S.y + p.y],
  ]),
  [320, 660, 480],
];

const noteEnd = (i: number) => T.pins[i] + 6 + Math.ceil(NOTES[i].length / 1.6);

/** Text arriving from dictation: the newest few characters are still grey. */
const Live: React.FC<{ text: string; live: boolean }> = ({ text, live }) => {
  const cut = live ? Math.max(0, text.length - 12) : text.length;
  return (
    <>
      {text.slice(0, cut)}
      <span style={{ color: C.muted }}>{text.slice(cut)}</span>
      {live && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: 15,
            marginLeft: 1,
            verticalAlign: "-2px",
            background: C.accent2,
          }}
        />
      )}
    </>
  );
};

const TOOLS = [
  { key: "select", glyph: "M4 2 L4 14 L7.5 11 L10 16 L12 15 L9.6 10 L14 10 Z", letter: "V" },
  { key: "box", glyph: "M3 4 H15 V14 H3 Z", letter: "B" },
  { key: "arrow", glyph: "M3 15 L14 4 M8 4 H14 V10", letter: "A" },
  { key: "pin", glyph: "", letter: "P" },
];

/** Excalidraw-style toolbar above the selection. */
const Toolbar: React.FC<{ active: string; enter: number }> = ({ active, enter }) => (
  <div
    style={{
      position: "absolute",
      left: S.x,
      top: S.y - 48,
      display: "flex",
      alignItems: "center",
      gap: 2,
      padding: 4,
      borderRadius: 10,
      background: C.panel,
      border: `1px solid ${C.line}`,
      boxShadow: "0 8px 24px #0007",
      opacity: enter,
      transform: `translateY(${(1 - enter) * 8}px)`,
    }}
  >
    {TOOLS.map((t) => {
      const on = t.key === active;
      return (
        <div
          key={t.key}
          style={{
            position: "relative",
            width: 34,
            height: 30,
            borderRadius: 7,
            display: "grid",
            placeItems: "center",
            background: on ? C.accent : "transparent",
            color: on ? "#fff" : C.muted,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
            {t.key === "pin" ? (
              <>
                <circle cx="9" cy="9" r="6.5" />
                <text x="9" y="12.2" textAnchor="middle" fontSize="9" fill="currentColor" stroke="none" fontWeight="700">
                  1
                </text>
              </>
            ) : (
              <path d={t.glyph} fill={t.key === "select" ? "currentColor" : "none"} />
            )}
          </svg>
          <span style={{ position: "absolute", right: 3, bottom: 1, fontSize: 8, opacity: 0.75 }}>{t.letter}</span>
        </div>
      );
    })}
    <div style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />
    <div style={{ width: 30, textAlign: "center", color: C.muted, fontSize: 16 }}>↶</div>
    <div style={{ width: 1, height: 22, background: C.line, margin: "0 4px" }} />
    {[C.pin, "#facc15", C.ok].map((c, i) => (
      <div
        key={c}
        style={{
          width: 15,
          height: 15,
          margin: "0 5px",
          borderRadius: "50%",
          background: c,
          boxShadow: i === 0 ? `0 0 0 2px ${C.panel}, 0 0 0 3.5px ${C.pin}` : "none",
        }}
      />
    ))}
  </div>
);

/** Caption bar + note rows under the selection. */
const EditorPanel: React.FC<{ f: number; enter: number }> = ({ f, enter }) => {
  const listening = f >= T.capStart && f < T.capEnd;
  const cleaned = f >= T.cleanAt;
  const ramble = typed(RAMBLE, f, T.capStart + 4, 1.5);
  const beforeOpen = pop(f, T.cleanAt, { damping: 200, stiffness: 120 });
  const after = pop(f, T.cleanAt + 4, { damping: 200 });
  const sweep = ramp(f, T.cleanKey, T.cleanAt + 4, -0.4, 1.2, easeInOut);
  const pinCount = PINS.filter((_, i) => f >= T.pins[i]).length;
  const chipGlow = interpolate(f, [T.cleanKey, T.cleanKey + 4, T.cleanAt + 10], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: S.x,
        top: S.y + S.h + 14,
        width: 580,
        borderRadius: 12,
        overflow: "hidden",
        background: C.panel,
        border: `1px solid ${C.line}`,
        boxShadow: "0 16px 40px #000a",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 12}px)`,
      }}
    >
      {/* caption row */}
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            flex: "none",
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            background: listening ? C.pin : C.panel2,
            boxShadow: listening ? "0 0 0 5px #ff3b7f33, 0 0 0 10px #ff3b7f18" : "none",
          }}
        >
          <svg width="11" height="15" viewBox="0 0 14 18" fill="none" stroke={listening ? "#fff" : C.muted} strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="1" width="6" height="10" rx="3" fill={listening ? "#fff" : C.muted} stroke="none" />
            <path d="M1.5 8.5a5.5 5.5 0 0 0 11 0M7 14v3" />
          </svg>
        </div>
        <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, paddingTop: 5, minHeight: 20 }}>
          {!cleaned ? (
            ramble ? (
              <Live text={ramble} live={listening} />
            ) : (
              <span style={{ color: C.muted }}>
                Say or type what to change… <Kbd keys="Ctrl+Space" size={17} />
              </span>
            )
          ) : (
            <>
              <div style={{ maxHeight: 44 * beforeOpen, overflow: "hidden" }}>
                <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: C.muted, paddingBottom: 6 }}>
                  <b style={{ fontSize: 10, letterSpacing: ".08em", paddingTop: 2, flex: "none" }}>BEFORE</b>
                  <span style={{ textDecoration: "line-through", textDecorationColor: "#9aa1b288" }}>{RAMBLE}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, opacity: after, transform: `translateY(${(1 - after) * 6}px)` }}>
                <b style={{ fontSize: 10, letterSpacing: ".08em", paddingTop: 3, flex: "none", color: C.accent2 }}>
                  ✨ AFTER
                </b>
                <span style={{ fontWeight: 600 }}>{CLEAN}</span>
              </div>
            </>
          )}
        </div>
        {listening && (
          <div style={{ paddingTop: 4 }}>
            <Waveform bars={10} height={22} />
          </div>
        )}
        <div
          style={{
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 9px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            color: "#ddd6fe",
            background: `rgba(139,92,246,${0.13 + 0.35 * chipGlow})`,
            border: "1px solid #8b5cf655",
            boxShadow: `0 0 ${18 * chipGlow}px ${C.accent}`,
          }}
        >
          {cleaned ? (
            <>
              ✓ Cleaned <Kbd keys="Ctrl+Z" size={16} /> undo
            </>
          ) : (
            <>
              ✨ Clean up <Kbd keys="Ctrl+K" size={16} />
            </>
          )}
        </div>
        {f >= T.cleanKey && f < T.cleanAt + 8 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(100deg, transparent ${sweep * 100 - 25}%, #8b5cf640 ${sweep * 100}%, transparent ${sweep * 100 + 25}%)`,
            }}
          />
        )}
      </div>

      {/* note rows, one per pin */}
      {NOTES.map((note, i) => {
        const open = pop(f, T.pins[i], { damping: 200, stiffness: 160 });
        if (open <= 0.001) return null;
        const active = f >= T.pins[i] && f < noteEnd(i) + 4;
        return (
          <div
            key={i}
            style={{
              height: 32 * open,
              overflow: "hidden",
              borderTop: i === 0 ? `1px solid ${C.line}` : "none",
              background: active ? "#ff3b7f14" : "transparent",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, height: 32, padding: "0 14px", fontSize: 13.5 }}>
              <PinBadge n={i + 1} size={20} />
              <span style={{ flex: 1 }}>
                <Live text={typed(note, f, T.pins[i] + 6, 1.6)} live={active} />
              </span>
              {active && <Waveform bars={10} height={18} />}
            </div>
          </div>
        );
      })}

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "7px 12px",
          borderTop: `1px solid ${C.line}`,
          background: "#13161c",
          color: C.muted,
          fontSize: 11.5,
          whiteSpace: "nowrap",
        }}
      >
        <span>{pinCount ? `${pinCount} pin${pinCount > 1 ? "s" : ""} · renumber automatically` : "Box B · Arrow A · Pin P"}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Kbd keys="Enter" size={17} /> send · <Kbd keys="Ctrl+Enter" size={17} /> + submit · <Kbd keys="Esc" size={17} />
        </span>
      </div>
    </div>
  );
};

/**
 * Everything inside the capture: browser with the Acme page, the freeze + dim, the
 * selection drag, then the in-place editor (toolbar, box, pins, caption bar), with
 * a camera move that zooms in on the editor.
 */
export const CaptureStage: React.FC = () => {
  const f = useCurrentFrame();
  const cur = along(f, CURSOR);

  const dim = ramp(f, T.freeze, T.freeze + 10);
  const flash = interpolate(f, [T.freeze, T.freeze + 2, T.freeze + 12], [0, 0.22, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dragging = f >= T.dragStart && f < T.editorIn;
  const sel =
    f < T.dragStart
      ? { w: 0, h: 0 }
      : f < T.dragEnd
        ? { w: cur.x - S.x, h: cur.y - S.y }
        : { w: S.w, h: S.h };
  const hint = Math.min(ramp(f, T.freeze + 6, T.freeze + 16), 1 - ramp(f, T.dragEnd, T.dragEnd + 8));
  const editor = pop(f, T.editorIn + 4, { damping: 200, stiffness: 140 });

  const box =
    f < T.boxStart
      ? null
      : f < T.boxEnd
        ? { w: cur.x - S.x - BOX.x, h: cur.y - S.y - BOX.y }
        : { w: BOX.w, h: BOX.h };
  const tool = f < T.boxKey ? "select" : f < T.pinKey + 2 ? "box" : "pin";
  const crossCursor = (f >= T.freeze && f < T.editorIn) || (f >= T.boxKey && f < 300);
  const clickAt = [T.boxStart, ...T.pins].find((c) => f >= c && f < c + 12);

  const camP = ramp(f, T.zoom[0], T.zoom[1], 0, 1, easeInOut);
  const focus = { x: STAGE.x + 350 * STAGE.s, y: STAGE.y + 433 * STAGE.s };

  return (
    <Camera p={camP} zoom={1.3} focus={focus} to={{ x: 960, y: 476 }}>
      <Place x={STAGE.x} y={STAGE.y} scale={STAGE.s}>
        <div style={{ position: "relative", width: 960, height: 600 }}>
          <Window x={0} y={0} w={960} h={600} variant="browser">
            <AcmePage />
          </Window>

          {/* capture overlay (covers the whole desktop, not just the browser) */}
          <div style={{ position: "absolute", left: -2000, top: -2000, width: 5000, height: 5000, background: "#fff", opacity: flash }} />
          {f >= T.freeze && (
            <Selection
              x={S.x}
              y={S.y}
              w={Math.max(0, sel.w)}
              h={Math.max(0, sel.h)}
              dim={dim}
              dashed={dragging && f < T.dragEnd}
              label={f < T.editorIn + 4 ? `${Math.round(sel.w)} × ${Math.round(sel.h)}` : undefined}
            />
          )}
          {hint > 0 && (
            <div
              style={{
                position: "absolute",
                left: 480,
                top: 548,
                transform: "translateX(-50%)",
                opacity: hint,
                padding: "8px 16px",
                borderRadius: 999,
                background: "#111827ee",
                border: "1px solid #ffffff22",
                color: "#e5e7eb",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Drag to select · <b>Esc</b> to cancel · <b>Space</b> to grab the whole window
            </div>
          )}

          {/* editor */}
          {f >= T.editorIn && (
            <>
              <div style={{ position: "absolute", left: S.x, top: S.y, width: S.w, height: S.h }}>
                {box && <SketchBox x={BOX.x} y={BOX.y} w={Math.max(0, box.w)} h={Math.max(0, box.h)} />}
                {PINS.map((p, i) => (
                  <Pin key={i} n={i + 1} x={p.x} y={p.y} at={T.pins[i]} size={24} />
                ))}
              </div>
              <Toolbar active={tool} enter={editor} />
              <EditorPanel f={f} enter={editor} />
            </>
          )}

          <Cursor
            x={cur.x}
            y={cur.y}
            kind={crossCursor ? "cross" : "arrow"}
            click={clickAt === undefined ? 0 : (f - clickAt) / 12}
            opacity={1 - ramp(f, 306, 318)}
            scale={1 / (1 + 0.3 * camP)}
          />
        </div>
      </Place>
    </Camera>
  );
};
