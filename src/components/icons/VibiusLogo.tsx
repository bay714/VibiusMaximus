import { laurel, leafPath } from "./laurel";

// Brand marks, not translatable text. Roman inscriptions use V for U.
const MONOGRAM = "VM";
const WORDMARK = ["VIBIVS", "MAXIMVS"];

/** The laurel-and-monogram emblem, optionally with the wordmark under it. */
const VibiusLogo = ({
  width = 120,
  wordmark = true,
  className = "",
}: {
  width?: number;
  wordmark?: boolean;
  className?: string;
}) => {
  const { leaves, stems, knot } = laurel();
  const emblem = wordmark ? width * 0.62 : width;
  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      style={{ width }}
    >
      <svg viewBox="0 0 100 100" width={emblem} height={emblem} aria-hidden>
        <g fill="var(--color-gold)">
          {leaves.map((l, i) => (
            <path
              key={i}
              d={leafPath(l.length, l.width)}
              transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}
            />
          ))}
        </g>
        {[...stems, knot].map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        ))}
        <text
          x="50"
          y="59"
          textAnchor="middle"
          className="font-display"
          fontWeight={700}
          fontSize={25}
          letterSpacing={-1}
          fill="var(--color-logo-primary)"
        >
          {MONOGRAM}
        </text>
      </svg>
      {wordmark && (
        <div
          className="font-display font-semibold text-center leading-tight mt-1"
          style={{ fontSize: width * 0.13, letterSpacing: "0.14em" }}
        >
          {WORDMARK.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VibiusLogo;
