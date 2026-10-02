// Masters the rendered video's audio to -14 LUFS (the usual target for online video) with a
// -1 dBTP ceiling, using two-pass loudnorm. The video stream is copied untouched.
//   node scripts/master.mjs out/raw.mp4 out/vibiusmaximus-how-to.mp4
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const [input, output] = process.argv.slice(2);
const remotion = path.resolve("node_modules/.bin", process.platform === "win32" ? "remotion.exe" : "remotion");
const target = "I=-14:TP=-1:LRA=11";

const probe = spawnSync(remotion, ["ffmpeg", "-hide_banner", "-i", input, "-vn", "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], {
  encoding: "utf8",
});
const json = (probe.stderr + probe.stdout).match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
if (!json) throw new Error(`loudnorm measurement failed:\n${probe.stderr}`);
const m = JSON.parse(json[0]);

const filter =
  `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
  `:measured_thresh=${m.input_thresh}:offset=${m.target_offset},aresample=48000`;
execFileSync(remotion, ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c:v", "copy", "-af", filter, "-c:a", "aac", "-b:a", "256k", output], {
  stdio: "inherit",
});
rmSync(input);
console.log(`mastered ${output} (was ${m.input_i} LUFS, ${m.input_tp} dBTP)`);
