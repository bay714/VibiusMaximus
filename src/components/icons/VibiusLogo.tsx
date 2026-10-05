import { BOSS, MONOGRAM, SHIELD, SHIELD_LEFT, SPINE } from "./shield";

// Brand mark, not translatable text. Roman inscriptions use V for U.
const WORDMARK = ["VIBIVS", "MAXIMVS"];

/** The shield emblem on its own. */
export const ShieldMark = ({ size = 40 }: { size?: number }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
    <path
      d={SHIELD}
      fill="var(--color-legion-red)"
      stroke="var(--color-bronze)"
      strokeWidth={4}
      strokeLinejoin="round"
    />
    <path d={SHIELD_LEFT} fill="#fff" opacity={0.08} />
    <path
      d={SPINE}
      stroke="var(--color-bronze)"
      strokeWidth={4}
      strokeLinecap="round"
    />
    <circle {...BOSS} fill="var(--color-bronze)" />
    <text
      x="50"
      y="55.5"
      textAnchor="middle"
      className="font-display"
      fontSize={15}
      fill="#2a1710"
    >
      {MONOGRAM}
    </text>
  </svg>
);

/** Shield and wordmark: side by side for the sidebar, stacked for onboarding. */
const VibiusLogo = ({
  layout = "inline",
  size = 36,
  className = "",
}: {
  layout?: "inline" | "stacked";
  size?: number;
  className?: string;
}) => (
  <div
    className={`flex select-none items-center ${
      layout === "stacked" ? "flex-col gap-2" : "gap-2.5"
    } ${className}`}
  >
    <ShieldMark size={size} />
    <div
      className={`font-display leading-[1.15] tracking-[0.16em] ${
        layout === "stacked" ? "text-center" : ""
      }`}
      style={{ fontSize: layout === "stacked" ? size * 0.2 : size * 0.33 }}
    >
      {WORDMARK.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  </div>
);

export default VibiusLogo;
