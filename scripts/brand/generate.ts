// VibiusMaximus brand assets: renders the app icon and the tray icons from
// the laurel geometry in src/components/icons/laurel.ts.
//
//   bun scripts/brand/generate.ts
//   bun run tauri icon scripts/brand/out/app-icon.png   # app icon sizes
//
// Rendering uses Playwright's Chromium. Set CHROMIUM_PATH if Playwright's own
// download doesn't match its version.

import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { laurelSvg } from "../../src/components/icons/laurel";

const PURPLE_LIGHT = "#8a3a78";
const PURPLE_DARK = "#3e1236";
const GOLD = "#d8b25a";
const IVORY = "#f6ecd2";
const RED = "#c0392b";

const font = readFileSync("src/assets/fonts/Cinzel-latin.woff2").toString(
  "base64",
);
const fontFace = `<style>@font-face{font-family:Cinzel;src:url(data:font/woff2;base64,${font})}</style>`;

const svg = (body: string, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><defs>${fontFace}${defs}</defs>${body}</svg>`;

const monogram = (text: string, size: number, color: string, y = 59) =>
  `<text x="50" y="${y}" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="${size}" fill="${color}" letter-spacing="-1">${text}</text>`;

/** The app icon: gold wreath and ivory monogram on imperial purple. */
const appIcon = svg(
  `<rect x="3" y="3" width="94" height="94" rx="21" fill="url(#bg)"/>` +
    `<rect x="6.5" y="6.5" width="87" height="87" rx="18" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="0.8"/>` +
    laurelSvg(GOLD) +
    monogram("VM", 25, IVORY),
  `<radialGradient id="bg" cx="50%" cy="36%" r="72%"><stop offset="0" stop-color="${PURPLE_LIGHT}"/><stop offset="1" stop-color="${PURPLE_DARK}"/></radialGradient>`,
);

// Tray icons are shown at 16-24 px, so the wreath gets fewer, bolder leaves.
const trayWreath = (color: string) =>
  laurelSvg(color, { pairs: 5, stroke: 4, scale: 1.25 });

type State = "idle" | "recording" | "transcribing";

function trayCenter(state: State, color: string, accent: string) {
  if (state === "recording")
    return `<circle cx="50" cy="49" r="15" fill="${accent}"/>`;
  if (state === "transcribing")
    return [36, 50, 64]
      .map((x) => `<circle cx="${x}" cy="50" r="6" fill="${color}"/>`)
      .join("");
  return monogram("V", 46, color, 65);
}

const warningBadge = (ring: string) =>
  `<circle cx="76" cy="76" r="22" fill="${RED}" stroke="${ring}" stroke-width="5"/>` +
  `<rect x="73" y="62" width="6" height="17" rx="3" fill="#fff"/><circle cx="76" cy="87" r="3.6" fill="#fff"/>`;

function tray(state: State, color: string, accent: string, warning = false) {
  return svg(
    trayWreath(color) +
      trayCenter(state, color, accent) +
      (warning
        ? warningBadge(color === "#ffffff" ? "#000000" : "#ffffff")
        : ""),
  );
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
    svg: tray(state, WHITE, state === "recording" ? RED : WHITE),
    size: 64,
  };
  files[`src-tauri/resources/tray_${state}_dark.png`] = {
    svg: tray(state, BLACK, state === "recording" ? RED : BLACK),
    size: 64,
  };
}
files["src-tauri/resources/tray_idle_warning.png"] = {
  svg: tray("idle", WHITE, WHITE, true),
  size: 64,
};
files["src-tauri/resources/tray_idle_warning_dark.png"] = {
  svg: tray("idle", BLACK, BLACK, true),
  size: 64,
};
// Coloured set (Linux trays that don't follow the light/dark theme).
files["src-tauri/resources/handy.png"] = {
  svg: tray("idle", PURPLE_LIGHT, GOLD),
  size: 64,
};
files["src-tauri/resources/handy_warning.png"] = {
  svg: tray("idle", PURPLE_LIGHT, GOLD, true),
  size: 64,
};
files["src-tauri/resources/recording.png"] = {
  svg: tray("recording", PURPLE_LIGHT, RED),
  size: 64,
};
files["src-tauri/resources/transcribing.png"] = {
  svg: tray("transcribing", PURPLE_LIGHT, GOLD),
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
