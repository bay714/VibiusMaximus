// VibiusMaximus README and website images: the hero banner, the three pillars,
// the five standing orders, the download button, the divider and the teaser
// GIF, all from the Legion palette, the shield and stills of the how-to video.
//
//   bun scripts/brand/readme.ts
//
// Writes docs/readme/*. Needs the video (video/vibiusmaximus-legion.mp4) and
// its Remotion ffmpeg (cd video && bun install). Rendering uses Playwright's
// Chromium; set CHROMIUM_PATH if Playwright's own download doesn't match.

import { chromium } from "playwright";
import { execFileSync } from "child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import {
  BOSS,
  MONOGRAM,
  SHIELD,
  SHIELD_LEFT,
  SPINE,
} from "../../src/components/icons/shield";

const OUT = "docs/readme";
const VIDEO = "video/vibiusmaximus-legion.mp4";
const FFMPEG =
  "video/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe";
const STILLS = join(tmpdir(), "vibius-readme-stills");

type Theme = "dark" | "light";

const PALETTE = {
  dark: {
    bg: "#17120f",
    bg2: "#0f0b09",
    panel: "#211915",
    line: "rgba(212,161,87,0.28)",
    text: "#f1e6d6",
    muted: "#b9a58c",
    accent: "#d4a157",
    glow: "rgba(212,161,87,0.16)",
  },
  light: {
    bg: "#f7f2ea",
    bg2: "#efe6d8",
    panel: "#fffaf2",
    line: "rgba(158,43,37,0.22)",
    text: "#221814",
    muted: "#6b5a4a",
    accent: "#9e2b25",
    glow: "rgba(192,138,67,0.20)",
  },
};

const RED = "#9e2b25";
const BRONZE = "#c08a43";

const font = readFileSync("src/assets/fonts/Marcellus-latin.woff2").toString(
  "base64",
);

/** Frames of the how-to video, by second. */
const STILL_AT = {
  capture: 92,
  speak: 52,
  command: 180,
  board: 136,
  sent: 141,
};

function extractStills() {
  mkdirSync(STILLS, { recursive: true });
  for (const [name, second] of Object.entries(STILL_AT)) {
    execFileSync(FFMPEG, [
      ...["-hide_banner", "-loglevel", "error", "-y"],
      ...["-ss", String(second), "-i", VIDEO, "-frames:v", "1"],
      join(STILLS, `${name}.png`),
    ]);
  }
}

const fileUrl = (path: string) =>
  "file:///" + resolve(path).replace(/\\/g, "/");

const still = (name: keyof typeof STILL_AT) =>
  fileUrl(join(STILLS, `${name}.png`));

/** CSS showing the region [x, y, w, h] of a 1920x1080 still, scaled to cover
 *  a box of width x height, centred. */
function crop(
  name: keyof typeof STILL_AT,
  [x, y, w, h]: [number, number, number, number],
  width: number,
  height: number,
) {
  const s = Math.max(width / w, height / h);
  const dx = (w * s - width) / 2;
  const dy = (h * s - height) / 2;
  return `width:${width}px;height:${height}px;background-image:url('${still(name)}');background-size:${1920 * s}px auto;background-position:${-(x * s + dx)}px ${-(y * s + dy)}px`;
}

const shield = (size: number) => `
<svg viewBox="0 0 100 100" width="${size}" height="${size}">
  <path d="${SHIELD}" fill="${RED}" stroke="${BRONZE}" stroke-width="4" stroke-linejoin="round"/>
  <path d="${SHIELD_LEFT}" fill="#fff" opacity="0.08"/>
  <path d="${SPINE}" stroke="${BRONZE}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="${BOSS.cx}" cy="${BOSS.cy}" r="${BOSS.r}" fill="${BRONZE}"/>
  <text x="50" y="55.5" text-anchor="middle" font-family="Marcellus" font-size="15" fill="#2a1710">${MONOGRAM}</text>
</svg>`;

/** A Greek-key (meander) band, the classic Roman border. */
const meander = (color: string, opacity: number) => {
  const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M0 22H20V6H8V14H14" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  // Single quotes only: this ends up inside a style="..." attribute.
  return `background-image:url('data:image/svg+xml,${encodeURIComponent(tile)}');background-size:24px 24px;opacity:${opacity}`;
};

/** Fades a band out at both ends. */
const FADE =
  "-webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)";

const base = (t: Theme) => {
  const p = PALETTE[t];
  return `
<style>
@font-face{font-family:Marcellus;src:url(data:font/woff2;base64,${font})}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:transparent}
body{font-family:"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif;color:${p.text};-webkit-font-smoothing:antialiased}
.display{font-family:Marcellus,serif;font-weight:400}
.eyebrow{font-family:Marcellus,serif;letter-spacing:.32em;text-transform:uppercase;color:${p.accent}}
.muted{color:${p.muted}}
.card{background:linear-gradient(180deg,${p.panel},${p.bg});border:1px solid ${p.line};border-radius:22px}
.shot{border-radius:14px;border:1px solid ${p.line};background-size:cover;box-shadow:0 30px 60px -20px rgba(0,0,0,${t === "dark" ? 0.7 : 0.35}),0 0 0 6px ${t === "dark" ? "rgba(212,161,87,0.06)" : "rgba(158,43,37,0.05)"}}
.key{display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:30px;padding:0 9px;border-radius:8px;font:600 14px "Segoe UI",sans-serif;
  color:${p.text};background:${t === "dark" ? "#2a201b" : "#fff"};border:1px solid ${p.line};box-shadow:0 2px 0 ${p.line}}
</style>`;
};

const pages: Record<
  string,
  (t: Theme) => { w: number; h: number; html: string }
> = {
  hero: (t) => {
    const p = PALETTE[t];
    return {
      w: 1280,
      h: 560,
      html: `${base(t)}
<div style="position:relative;width:1280px;height:560px;overflow:hidden;border-radius:26px;
  background:radial-gradient(circle at 22% 40%,${p.glow},transparent 55%),radial-gradient(circle at 85% 70%,${t === "dark" ? "rgba(158,43,37,0.18)" : "rgba(158,43,37,0.08)"},transparent 50%),linear-gradient(160deg,${p.bg},${p.bg2})">
  <div style="position:absolute;inset:16px;border:1px solid ${p.line};border-radius:18px"></div>
  <div style="position:absolute;left:40px;right:40px;top:34px;height:24px;${meander(BRONZE, t === "dark" ? 0.2 : 0.28)};${FADE}"></div>
  <div style="position:absolute;left:40px;right:40px;bottom:34px;height:24px;${meander(BRONZE, t === "dark" ? 0.2 : 0.28)};${FADE}"></div>
  <div style="position:absolute;left:84px;top:96px;width:560px">
    <div class="eyebrow" style="font-size:15px">For AI vibe coding</div>
    <div style="display:flex;align-items:center;gap:22px;margin-top:22px">
      <div style="filter:drop-shadow(0 10px 24px rgba(158,43,37,.45))">${shield(108)}</div>
      <div class="display" style="font-size:58px;line-height:1.04;letter-spacing:.13em">VIBIVS<br>MAXIMVS</div>
    </div>
    <div style="font-size:30px;font-weight:600;margin-top:30px;letter-spacing:-.01em">Speak it. Show it. <span style="color:${p.accent}">Command your AI.</span></div>
    <div class="muted" style="font-size:17px;line-height:1.5;margin-top:12px;max-width:520px">Offline voice, annotated screen captures and one-key prompt macros for Claude, ChatGPT, Cursor and every terminal agent.</div>
    <div class="eyebrow" style="font-size:16px;margin-top:30px;letter-spacing:.42em">Veni · Vidi · Vibed</div>
  </div>
  <div class="shot" style="position:absolute;left:690px;top:74px;${crop("capture", [470, 172, 980, 783], 520, 415)};transform:perspective(1400px) rotateY(-9deg) rotateX(2deg)"></div>
  <div style="position:absolute;left:1112px;top:70px;display:flex;gap:8px;transform:rotate(4deg)">
    <span class="key" style="height:44px;min-width:56px;font-size:18px">Alt</span><span class="key" style="height:44px;min-width:44px;font-size:18px">S</span>
  </div>
</div>`,
    };
  },

  pillars: (t) => {
    const p = PALETTE[t];
    const items = [
      [
        "I",
        "Speak",
        "Hold a key, talk, let go. Your words land at the cursor, transcribed on your own machine.",
        "speak",
        [300, 150, 1320, 886],
        ["Ctrl", "Space"],
      ],
      [
        "II",
        "Show",
        "Freeze the screen, box what to change, drop numbered pins and say what each one means.",
        "capture",
        [470, 300, 980, 658],
        ["Alt", "S"],
      ],
      [
        "III",
        "Command",
        "Fire world-class prompts with one key: Research, Summarize, Plan, Scope, Execute.",
        "command",
        [470, 160, 1370, 920],
        ["Alt", "1–5"],
      ],
    ] as const;
    return {
      w: 1280,
      h: 468,
      html: `${base(t)}
<div style="display:flex;gap:24px;width:1280px;height:468px">
${items
  .map(
    ([num, title, text, img, region, keys]) => `
  <div class="card" style="flex:1;padding:30px 28px;position:relative;overflow:hidden">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div class="display" style="font-size:44px;color:${p.accent};line-height:1">${num}</div>
      <div style="display:flex;gap:6px">${keys.map((k) => `<span class="key">${k}</span>`).join("")}</div>
    </div>
    <div class="display" style="font-size:30px;letter-spacing:.16em;text-transform:uppercase;margin-top:16px">${title}</div>
    <div class="muted" style="font-size:16px;line-height:1.5;margin-top:10px;height:72px">${text}</div>
    <div class="shot" style="margin-top:22px;${crop(img, region as [number, number, number, number], 354, 238)}"></div>
  </div>`,
  )
  .join("")}
</div>`,
    };
  },

  orders: (t) => {
    const p = PALETTE[t];
    const orders = [
      [
        "I",
        "Research",
        "Primary sources first. The answer up front, every finding cited, fact kept apart from guesswork.",
      ],
      [
        "II",
        "Summarize",
        "Bottom line first, then each topic's status and next step, then the decisions you owe.",
      ],
      [
        "III",
        "Plan",
        "Goal, files, steps, checks and risks. Up to three questions. No code until you say go.",
      ],
      [
        "IV",
        "Scope",
        "A spec a builder can follow blind: non-goals, testable criteria, small tasks, review gates.",
      ],
      [
        "V",
        "Execute",
        "The AI becomes the general: briefs builders, runs work in parallel, checks every result.",
      ],
    ];
    return {
      w: 1280,
      h: 272,
      html: `${base(t)}
<div style="display:flex;gap:16px;width:1280px;height:272px">
${orders
  .map(
    ([num, name, text], i) => `
  <div class="card" style="flex:1;padding:24px 20px;position:relative">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="display" style="font-size:38px;color:${p.accent};line-height:1">${num}</div>
      <div style="display:flex;gap:5px"><span class="key">Alt</span><span class="key">${i + 1}</span></div>
    </div>
    <div style="height:1px;background:${p.line};margin:18px 0 16px"></div>
    <div class="display" style="font-size:24px;letter-spacing:.12em;text-transform:uppercase">${name}</div>
    <div class="muted" style="font-size:15px;line-height:1.5;margin-top:10px">${text}</div>
    ${i < 4 ? `<div style="position:absolute;right:-13px;top:50%;width:10px;height:10px;transform:translateY(-50%) rotate(45deg);background:${p.accent};opacity:.6;z-index:2"></div>` : ""}
  </div>`,
  )
  .join("")}
</div>`,
    };
  },

  download: (t) => ({
    w: 900,
    h: 132,
    html: `${base(t)}
<div style="width:900px;height:132px;padding:6px">
  <div style="height:120px;border-radius:60px;display:flex;align-items:center;gap:22px;padding:0 44px 0 30px;
    background:linear-gradient(180deg,#b9362d,#8a221d);border:2px solid ${BRONZE};
    box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 14px 30px -12px rgba(158,43,37,.6)">
    <div style="filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))">${shield(78).replace(`fill="${RED}"`, 'fill="#7a1c18"')}</div>
    <div>
      <div class="display" style="font-size:29px;letter-spacing:.12em;color:#fff4e2;white-space:nowrap">DOWNLOAD THE LATEST VERSION</div>
      <div style="font-size:16px;color:#f3d6b0;margin-top:4px;letter-spacing:.02em">Windows · macOS (beta) · free and open source</div>
    </div>
    <svg viewBox="0 0 24 24" width="40" height="40" style="margin-left:auto" fill="none" stroke="#fff4e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>
  </div>
</div>`,
  }),

  divider: (t) => ({
    w: 1280,
    h: 28,
    html: `${base(t)}
<div style="width:1280px;height:28px;display:flex;align-items:center;gap:18px">
  <div style="flex:1;height:24px;${meander(BRONZE, 0.6)};${FADE}"></div>
  <div style="transform:translateY(1px)">${shield(26)}</div>
  <div style="flex:1;height:24px;${meander(BRONZE, 0.6)};${FADE}"></div>
</div>`,
  }),

  board: (t) => {
    const p = PALETTE[t];
    return {
      w: 1280,
      h: 560,
      html: `${base(t)}
<div class="card" style="width:1280px;height:560px;padding:34px;display:flex;gap:36px">
  <div style="width:330px;display:flex;flex-direction:column">
    <div class="eyebrow" style="font-size:14px">The campaign</div>
    <div class="display" style="font-size:34px;letter-spacing:.14em;margin-top:14px">THE BOARD</div>
    <div class="muted" style="font-size:17px;line-height:1.55;margin-top:14px">Line up several screenshots, text boxes and numbered pins. One key sends them all, in reading order, each image labelled to match.</div>
    <div class="muted" style="font-size:17px;line-height:1.55;margin-top:14px">Every board is saved: reopen, rename or start a new one.</div>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:12px;font-size:15px">
      <div style="display:flex;align-items:center;gap:8px"><span class="key">Alt</span><span class="key">B</span><span class="muted">open the board</span></div>
      <div style="display:flex;align-items:center;gap:8px"><span class="key">Ctrl</span><span class="key">Enter</span><span class="muted">send in formation</span></div>
    </div>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;gap:18px;justify-content:center">
    <div class="shot" style="${crop("board", [110, 172, 1700, 545], 846, 271)}"></div>
    <div style="display:flex;align-items:center;gap:12px;color:${p.accent};font:600 14px 'Segoe UI',sans-serif;letter-spacing:.2em;text-transform:uppercase"><span style="flex:1;height:1px;background:${p.line}"></span>arrives as<span style="flex:1;height:1px;background:${p.line}"></span></div>
    <div class="shot" style="${crop("sent", [585, 235, 965, 300], 846, 200)}"></div>
  </div>
</div>`,
    };
  },
};

/** A short highlight reel from the video: capture, pins, send, board, macros. */
function teaser() {
  const parts: [number, number][] = [
    [64, 9],
    [99, 5],
    [113, 5],
    [134, 7],
    [152, 5],
  ];
  const inputs = parts.flatMap(([s, d]) => [
    "-ss",
    String(s),
    "-t",
    String(d),
    "-i",
    VIDEO,
  ]);
  const scaled = parts
    .map((_, i) => `[${i}:v]scale=800:-2:flags=lanczos[v${i}]`)
    .join(";");
  const joined =
    parts.map((_, i) => `[v${i}]`).join("") +
    `concat=n=${parts.length}:v=1:a=0[all]`;
  const palette = `[all]split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
  execFileSync(FFMPEG, [
    ...["-hide_banner", "-loglevel", "error", "-y", ...inputs],
    ...["-filter_complex", `${scaled};${joined};${palette}`, "-r", "10"],
    join(OUT, "teaser.gif"),
  ]);
}

mkdirSync(OUT, { recursive: true });
extractStills();
// Poster for the website's video player: the title card.
execFileSync(FFMPEG, [
  ...["-hide_banner", "-loglevel", "error", "-y", "-ss", "22", "-i", VIDEO],
  ...[
    "-frames:v",
    "1",
    "-vf",
    "scale=1280:-2",
    "-q:v",
    "3",
    join(OUT, "poster.jpg"),
  ],
]);
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
);
for (const [name, render] of Object.entries(pages)) {
  const themes: Theme[] = ["download", "divider"].includes(name)
    ? ["dark"]
    : ["dark", "light"];
  for (const t of themes) {
    const { w, h, html } = render(t);
    const page = await browser.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 2,
    });
    // Loaded from a file so the page may show the stills (file:// URLs).
    const htmlFile = join(STILLS, `${name}-${t}.html`);
    writeFileSync(htmlFile, `<!doctype html><meta charset="utf-8">${html}`);
    await page.goto(fileUrl(htmlFile), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const file = join(
      OUT,
      themes.length > 1 ? `${name}-${t}.png` : `${name}.png`,
    );
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
    console.log(file, Math.round(statSync(file).size / 1024), "KB");
  }
}
await browser.close();
teaser();
console.log(
  join(OUT, "teaser.gif"),
  Math.round(statSync(join(OUT, "teaser.gif")).size / 1024),
  "KB",
);
