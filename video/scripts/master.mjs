// Masters the rendered video's audio: measures loudness and true peak, then applies one static
// gain that reaches the target loudness without pushing peaks past the ceiling (no limiter, so
// nothing pumps or distorts). The video stream is copied untouched.
//   node scripts/master.mjs <in.mp4> <out.mp4> [targetLUFS=-14] [ceilingDBTP=-1]
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const [input, output, targetArg = "-14", ceilingArg = "-1"] = process.argv.slice(2);
const target = Number(targetArg);
const ceiling = Number(ceilingArg);
const remotion = path.resolve("node_modules/.bin", process.platform === "win32" ? "remotion.exe" : "remotion");

const probe = spawnSync(remotion, ["ffmpeg", "-hide_banner", "-i", input, "-vn", "-af", "loudnorm=print_format=json", "-f", "null", "-"], {
  encoding: "utf8",
});
const json = (probe.stderr + probe.stdout).match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
if (!json) throw new Error(`loudness measurement failed:\n${probe.stderr}`);
const m = JSON.parse(json[0]);
const gain = Math.min(target - Number(m.input_i), ceiling - Number(m.input_tp));

execFileSync(
  remotion,
  ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c:v", "copy", "-af", `volume=${gain.toFixed(2)}dB,aresample=48000`, "-c:a", "aac", "-b:a", "256k", output],
  { stdio: "inherit" },
);
rmSync(input);
console.log(
  `mastered ${output}: ${gain >= 0 ? "+" : ""}${gain.toFixed(2)} dB (was ${m.input_i} LUFS, ${m.input_tp} dBTP; now about ${(Number(m.input_i) + gain).toFixed(1)} LUFS)`,
);
