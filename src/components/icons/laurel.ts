// VibiusMaximus brand: a laurel wreath, open at the top and tied at the
// bottom, drawn from a little geometry so the in-app logo, the app icon and
// the tray icons (scripts/brand/) all come from one source.
//
// Coordinates are in a 100 x 100 box. Each leaf is drawn along +x from its
// base at the origin, then moved to (x, y) and rotated by `angle` degrees.

export interface Leaf {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
}

export interface Laurel {
  leaves: Leaf[];
  /** The two branch stems, as SVG path data. */
  stems: string[];
  /** Ribbon knot at the bottom, as SVG path data. */
  knot: string;
}

const CX = 50;
const CY = 50;
const R = 33;

/** Point on the wreath circle; `deg` runs clockwise from the top. */
function at(deg: number, r = R) {
  const a = (deg * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}

/** Leaf outline pointing along +x, base at the origin. */
export function leafPath(length: number, width: number): string {
  const l = length;
  const w = width / 2;
  return `M0 0C${l * 0.25} ${-w} ${l * 0.7} ${-w} ${l} 0C${l * 0.7} ${w} ${l * 0.25} ${w} 0 0Z`;
}

export function laurel({
  pairs = 7,
  from = 158,
  to = 28,
}: { pairs?: number; from?: number; to?: number } = {}): Laurel {
  const right: Leaf[] = [];
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const deg = from - (from - to) * t;
    // Direction the branch grows (up the right side): decreasing angle.
    const a = (deg * Math.PI) / 180;
    const grow = (Math.atan2(-Math.sin(a), Math.cos(a)) * 180) / Math.PI;
    const length = 15 - 5 * t;
    const width = 7 - 2.2 * t;
    const base = at(deg);
    right.push({ ...base, angle: grow - 38, length, width });
    right.push({ ...base, angle: grow + 34, length: length * 0.92, width });
  }
  // A single leaf at the tip, pointing on along the branch.
  const tip = at(to);
  const ta = (to * Math.PI) / 180;
  right.push({
    ...tip,
    angle: (Math.atan2(-Math.sin(ta), Math.cos(ta)) * 180) / Math.PI,
    length: 9.5,
    width: 4.8,
  });

  const mirror = (l: Leaf): Leaf => ({
    ...l,
    x: 100 - l.x,
    angle: 180 - l.angle,
  });
  const leaves = [...right, ...right.map(mirror)];

  const s = at(from);
  const e = at(to);
  const stemRight = `M${s.x} ${s.y}A${R} ${R} 0 0 0 ${e.x} ${e.y}`;
  const stemLeft = `M${100 - s.x} ${s.y}A${R} ${R} 0 0 1 ${100 - e.x} ${e.y}`;

  // A small bow where the stems meet, with two ribbon tails.
  const b = at(180);
  const knot =
    `M${s.x} ${s.y}Q${b.x} ${b.y + 3} ${100 - s.x} ${s.y}` +
    `M${b.x} ${b.y + 1.5}l-6 7M${b.x} ${b.y + 1.5}l6 7`;

  return { leaves, stems: [stemRight, stemLeft], knot };
}

/** The wreath as an SVG fragment (for the icon generator). `scale` makes
 *  leaves bigger for small icons. */
export function laurelSvg(
  color: string,
  { pairs = 7, stroke = 2.2, scale = 1 } = {},
): string {
  const { leaves, stems, knot } = laurel({ pairs });
  const leafEls = leaves
    .map(
      (l) =>
        `<path d="${leafPath(l.length * scale, l.width * scale)}" transform="translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.angle.toFixed(1)})"/>`,
    )
    .join("");
  const lines = [...stems, knot]
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`,
    )
    .join("");
  return `<g fill="${color}">${leafEls}</g>${lines}`;
}
