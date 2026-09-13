// scene-mux: mux verified per-scene mp4s with their beat audio, then join all.
//   node scene-mux.mjs <config.json> [n n n ...]   (default: every scene in config)
// Per scene: scene<n>.mp4 + beat-<n>.wav -> seg<n>.mp4, trimmed to beat duration
// (video padded if the take ran short, tail trimmed if long). All segments get
// identical codec params so the concat is a stream copy, no re-encode.
// Output: config.final (required path).
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";

const CONFIG_PATH = process.argv[2];
const ONLY = process.argv.slice(3).map(Number);
const CONFIG = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const { voDir, outDir } = CONFIG;
const dur = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${f}`).toString());
const sh = (c) => execSync(c, { stdio: ["ignore", "ignore", "pipe"] });

const nums = ONLY.length ? ONLY : Object.keys(CONFIG.scenes).map(Number).sort((a, b) => a - b);
const segs = [];

for (const n of nums) {
  const scene = `${outDir}/scene${n}.mp4`;
  const beat = `${voDir}/beat-${n}.wav`;
  const seg = `${outDir}/seg${n}.mp4`;
  const bd = dur(beat);
  const vd = dur(scene);
  // Per-scene payoff tail (seconds kept AFTER the beat): config
  // tails: {"<scene>": seconds}, default 0.05. Deliberate 2-3s holds after
  // verdict cards / the close are pacing, not dead air.
  const tail = Number(CONFIG.tails?.[String(n)] ?? 0.05);
  const keep = bd + tail;
  if (vd < keep) {
    console.log(`scene${n}: video ${vd.toFixed(2)}s < beat+tail ${keep.toFixed(2)}s -> padding last frame`);
    sh(`ffmpeg -y -i ${scene} -vf "tpad=stop_mode=clone:stop_duration=${(keep - vd + 0.2).toFixed(2)}" -c:v libx264 -preset ultrafast -crf 20 -an ${outDir}/scene${n}-padded.mp4 2>/dev/null`);
    sh(`mv ${outDir}/scene${n}-padded.mp4 ${scene}`);
  }
  // VFR screencapture captures book the last frame's freeze-hold into stream
  // duration, so -t alone overshoots; normalize to CFR first, then trim exact.
  // CRITICAL: every recording also opens with ~15 grey placeholder frames
  // (uniform Y=128) from the capture attach — trim=start=0.5333 drops them.
  sh(`ffmpeg -y -i ${scene} -i ${beat} -map 0:v:0 -map 1:a:0 -vf "trim=start=0.5333,setpts=PTS-STARTPTS,fps=30,trim=duration=${keep.toFixed(3)},setpts=PTS-STARTPTS" -af "asetpts=PTS-STARTPTS,atrim=duration=${(bd + 0.05).toFixed(3)},asetpts=PTS-STARTPTS" -c:v libx264 -preset ultrafast -crf 20 -c:a aac -ar 44100 -ac 2 -b:a 160k ${seg} 2>/dev/null`);
  const sd = dur(seg);
  console.log(`seg${n}: ${sd.toFixed(2)}s (beat ${bd.toFixed(2)}s + tail ${tail.toFixed(2)}s)`);
  segs.push(`file '${seg}'`);
}

const listPath = `${outDir}/concat.txt`;
writeFileSync(listPath, segs.join("\n") + "\n");
rmSync(CONFIG.final, { force: true });
sh(`ffmpeg -y -f concat -safe 0 -i ${listPath} -c copy ${CONFIG.final} 2>/dev/null`);
const total = dur(CONFIG.final);
const expected = nums.reduce((s, n) => s + dur(`${voDir}/beat-${n}.wav`) + Number(CONFIG.tails?.[String(n)] ?? 0.05), 0);
console.log(`FINAL ${CONFIG.final}: ${total.toFixed(2)}s (expected ~${expected.toFixed(2)}s)`);
if (!existsSync(CONFIG.final)) { console.error("mux failed"); process.exit(1); }
