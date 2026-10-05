// VibiusMaximus brand: a legionary shield (scutum), kept flat and simple.
// One set of shapes, in a 100 x 100 box, feeds the in-app logo, the app icon
// and the tray icons (scripts/brand/generate.ts).

/** The shield's outline: a tall, barrel-curved rectangle. */
export const SHIELD = "M30 13Q50 8 70 13Q77 50 70 87Q50 92 30 87Q23 50 30 13Z";

/** Left half of the shield, for a soft two-tone highlight. */
export const SHIELD_LEFT =
  "M50 10.5Q40 10.5 30 13Q23 50 30 87Q40 89.5 50 89.5Z";

/** The spine (spina) running through the boss, top and bottom. */
export const SPINE = "M50 17V36M50 64V83";

/** Boss at the centre. */
export const BOSS = { cx: 50, cy: 50, r: 14 };

export const MONOGRAM = "VM";
