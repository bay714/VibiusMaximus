// VibiusMaximus brand assets: renders the app icon and the tray icons from
// the shield shapes in src/components/icons/shield.ts.
//
//   bun scripts/brand/generate.ts
//   bun run tauri icon scripts/brand/out/app-icon.png   # app icon sizes
//
// Rendering uses Playwright's Chromium. Set CHROMIUM_PATH if Playwright's own
// download doesn't match its version.

import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import {
  BOSS,
  MONOGRAM,
  SHIELD,
  SHIELD_LEFT,
  SPINE,
} from "../../src/components/icons/shield";

const RED = "#9e2b25";
const BRONZE = "#c08a43";
const TILE_TOP = "#2a1e19";
const TILE_BOTTOM = "#140e0b";
const LETTER = "#2a1710";
const REC = "#e5483b";

const font = readFileSync("src/assets/fonts/Marcellus-latin.woff2").toString(
  "base64",
);
const fontFace = `<style>@font-face{font-family:Marcellus;src:url(data:font/woff2;base64,${font})}</style>`;

const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><defs>${fontFace}${defs}</defs>${body}</svg>`;

/** The full-colour shield with its VM boss. */
const shield = (scale = 1) =>
  `<g transform="translate(50 50) scale(${scale}) translate(-50 -50)">` +
  `<path d="${SHIELD}" fill="${RED}" stroke="${BRONZE}" stroke-width="4" stroke-linejoin="round"/>` +
  `<path d="${SHIELD_LEFT}" fill="#fff" opacity="0.08"/>` +
  `<path d="${SPINE}" stroke="${BRONZE}" stroke-width="4" stroke-linecap="round"/>` +
  `<circle cx="${BOSS.cx}" cy="${BOSS.cy}" r="${BOSS.r}" fill="${BRONZE}"/>` +
  `<text x="50" y="55.5" text-anchor="middle" font-family="Marcellus" font-size="15" fill="${LETTER}">${MONOGRAM}</text>` +
  `</g>`;

/** The app icon: the shield on a dark tile with a bronze hairline. */
const appIcon = svg(
  `<rect x="3" y="3" width="94" height="94" rx="21" fill="url(#tile)"/>` +
    `<rect x="6.5" y="6.5" width="87" height="87" rx="18" fill="none" stroke="${BRONZE}" stroke-opacity="0.35" stroke-width="0.8"/>` +
    shield(0.86),
  `<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${TILE_TOP}"/><stop offset="1" stop-color="${TILE_BOTTOM}"/></linearGradient>`,
);

// Tray icons are shown at 16-24 px: a wider, solid shield silhouette with the
// boss cut out, so it stays readable in one colour. The centre shows the state.
const TRAY_SHIELD = "M23 11Q50 5 77 11Q85 50 77 89Q50 95 23 89Q15 50 23 11Z";
type State = "idle" | "recording" | "transcribing";

function tray(state: State, color: string, warning = false) {
  const holes =
    state === "transcribing"
      ? [38, 50, 62]
          .map((x) => `<circle cx="${x}" cy="50" r="5.5" fill="#000"/>`)
          .join("")
      : `<circle cx="50" cy="50" r="15" fill="#000"/>`;
  const mask = `<mask id="m"><rect width="100" height="100" fill="#fff"/>${holes}</mask>`;
  const centre =
    state === "recording"
      ? `<circle cx="50" cy="50" r="10" fill="${REC}"/>`
      : state === "idle"
        ? `<circle cx="50" cy="50" r="7" fill="${color}"/>`
        : "";
  const ring = color === "#ffffff" ? "#000000" : "#ffffff";
  const badge = warning
    ? `<circle cx="76" cy="76" r="20" fill="#c0392b" stroke="${ring}" stroke-width="5"/>` +
      `<rect x="73" y="63" width="6" height="16" rx="3" fill="#fff"/><circle cx="76" cy="86" r="3.4" fill="#fff"/>`
    : "";
  return svg(
    `<path d="${TRAY_SHIELD}" fill="${color}" mask="url(#m)"/>` +
      centre +
      badge,
    mask,
  );
}

/** Coloured tray icons (Linux trays that ignore the light/dark theme). */
function colouredTray(state: State, warning = false) {
  const centre =
    state === "recording"
      ? `<circle cx="50" cy="50" r="11" fill="${REC}"/>`
      : state === "transcribing"
        ? [40, 50, 60]
            .map((x) => `<circle cx="${x}" cy="50" r="3.6" fill="${LETTER}"/>`)
            .join("")
        : "";
  const body =
    `<path d="${TRAY_SHIELD}" fill="${RED}" stroke="${BRONZE}" stroke-width="5" stroke-linejoin="round"/>` +
    `<circle cx="50" cy="50" r="15" fill="${BRONZE}"/>` +
    centre;
  const badge = warning
    ? `<circle cx="76" cy="76" r="20" fill="#c0392b" stroke="#fff" stroke-width="5"/>` +
      `<rect x="73" y="63" width="6" height="16" rx="3" fill="#fff"/><circle cx="76" cy="86" r="3.4" fill="#fff"/>`
    : "";
  return svg(body + badge);
}

const files: Record<string, { svg: string; size: number }> = {
  "scripts/brand/out/app-icon.png": { svg: appIcon, size: 1024 },
  "src-tauri/icons/logo.png": { svg: appIcon, size: 1024 },
};
const WHITE = "#ffffff";
const BLACK = "#000000";
for (const state of ["idle", "recording", "transcribing"] as const) {
  // Dark taskbar: white glyphs. Light taskbar: black glyphs (the `_dark`
  // files, named for the glyph colour, as in Handy).
  files[`src-tauri/resources/tray_${state}.png`] = {
    svg: tray(state, WHITE),
    size: 64,
  };
  files[`src-tauri/resources/tray_${state}_dark.png`] = {
    svg: tray(state, BLACK),
    size: 64,
  };
}
files["src-tauri/resources/tray_idle_warning.png"] = {
  svg: tray("idle", WHITE, true),
  size: 64,
};
files["src-tauri/resources/tray_idle_warning_dark.png"] = {
  svg: tray("idle", BLACK, true),
  size: 64,
};
files["src-tauri/resources/handy.png"] = {
  svg: colouredTray("idle"),
  size: 64,
};
files["src-tauri/resources/handy_warning.png"] = {
  svg: colouredTray("idle", true),
  size: 64,
};
files["src-tauri/resources/recording.png"] = {
  svg: colouredTray("recording"),
  size: 64,
};
files["src-tauri/resources/transcribing.png"] = {
  svg: colouredTray("transcribing"),
  size: 64,
};

mkdirSync("scripts/brand/out", { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
const page = await browser.newPage();
for (const [path, { svg: markup, size }] of Object.entries(files)) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;width:${size}px;height:${size}px">${markup}</body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, omitBackground: true });
  if (path.endsWith("app-icon.png"))
    writeFileSync("scripts/brand/out/app-icon.svg", markup);
  console.log("wrote", path);
}
await browser.close();
