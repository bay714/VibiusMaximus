import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../theme";
import { Window } from "./Window";

/** Blinking text caret. `solid` keeps it on, e.g. while text is arriving. */
export const Caret: React.FC<{ solid?: boolean; height?: number }> = ({ solid, height = 18 }) => {
  const f = useCurrentFrame();
  const on = solid || Math.floor(f / 15) % 2 === 0;
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height,
        marginLeft: 1,
        verticalAlign: "-3px",
        background: C.accent2,
        opacity: on ? 1 : 0,
      }}
    />
  );
};

/** The chat input box: attachments row, text, and a footer with the send button. */
export const ChatComposer: React.FC<{
  attachments?: React.ReactNode;
  placeholder?: string;
  children?: React.ReactNode;
}> = ({ attachments, placeholder = "Message the AI…", children }) => (
  <div
    style={{
      background: C.panel2,
      border: "1px solid #313745",
      borderRadius: 18,
      padding: "14px 16px 12px",
      boxShadow: "0 10px 30px #0006",
    }}
  >
    {attachments && <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{attachments}</div>}
    <div style={{ fontSize: 15.5, lineHeight: 1.55, minHeight: 24, whiteSpace: "pre-wrap", color: C.text }}>
      {children ?? <span style={{ color: C.muted }}>{placeholder}</span>}
    </div>
    <div style={{ display: "flex", alignItems: "center", marginTop: 10, color: C.muted, fontSize: 12.5 }}>
      + Attach · Model: Claude
      <div
        style={{
          marginLeft: "auto",
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: C.text,
          color: "#111",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
        }}
      >
        ↑
      </div>
    </div>
  </div>
);

/**
 * A generic AI chat app (960×600 design space): conversation list on the left,
 * messages above, composer pinned to the bottom.
 */
export const ChatWindow: React.FC<{
  x?: number;
  y?: number;
  convos?: string[];
  active?: number;
  composer: React.ReactNode;
  overlay?: React.ReactNode;
  children?: React.ReactNode;
}> = ({
  x = 0,
  y = 0,
  convos = ["Acme landing page fixes", "Auth refactor", "Pricing table"],
  active = 0,
  composer,
  overlay,
  children,
}) => (
  <Window x={x} y={y} w={960} h={600} title="AI Chat">
    <div style={{ display: "flex", height: "100%" }}>
      <div style={{ width: 200, background: "#13151a", borderRight: `1px solid ${C.line}`, padding: 12 }}>
        <div
          style={{
            border: `1px solid ${C.line}`,
            borderRadius: 8,
            padding: "7px 10px",
            fontSize: 13,
            color: C.muted,
            marginBottom: 12,
          }}
        >
          + New chat
        </div>
        {convos.map((c, i) => (
          <div
            key={c}
            style={{
              padding: "8px 10px",
              borderRadius: 7,
              fontSize: 13,
              color: i === active ? C.text : C.muted,
              background: i === active ? "#22252e" : "transparent",
              marginBottom: 2,
              whiteSpace: "nowrap",
            }}
          >
            {c}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, position: "relative", padding: "24px 48px 0" }}>{children}</div>
        <div style={{ padding: "12px 40px 22px" }}>{composer}</div>
        {overlay}
      </div>
    </div>
  </Window>
);

/** A previous message in the thread. */
export const Bubble: React.FC<{ from: "ai" | "you"; children: React.ReactNode }> = ({ from, children }) => (
  <div style={{ display: "flex", justifyContent: from === "you" ? "flex-end" : "flex-start", marginBottom: 12 }}>
    <div
      style={{
        maxWidth: 520,
        padding: "10px 14px",
        borderRadius: 14,
        fontSize: 14.5,
        lineHeight: 1.5,
        background: from === "you" ? "#262a35" : "transparent",
        border: from === "ai" ? "none" : `1px solid ${C.line}`,
        color: from === "ai" ? "#c9cdd8" : C.text,
      }}
    >
      {children}
    </div>
  </div>
);
