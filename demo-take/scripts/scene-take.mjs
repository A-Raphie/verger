// scene-take: PER-SCENE desktop demo take runner (v5 path). Generic, any project.
// Records ONE scene against the live site, converts to mp4, exits. Verify frames
// between scenes; re-record only the failures, join after every scene passes.
//
//   node scene-take.mjs <config.json> <n>          -> prep + record scene n + convert
//   node scene-take.mjs <config.json> <n> check    -> run prep, then print every locator's
//                                                     coords (validates the whole scene, no recording)
//   node scene-take.mjs <config.json> <n> prep     -> only state setup (no recording)
//
// Config schema (JSON) — ALL project data lives here, the runner has none of it:
//   driver:   wallet-remote base (default http://127.0.0.1:9333)
//   cdp:      Chrome remote-debugging base (default http://127.0.0.1:9222)
//   voDir:    dir with beat-<n>.wav (VO pacing source of truth)
//   outDir:   where scene<n>.mp4 / scene<n>-raw.mov land
//   browserProcess: optional fallback name for System Events window lookup
//   locators: { name: "<js expression returning an Element>" }  (project-specific targets)
//   scenes:   { "<n>": { name, prep?: [action], actions: [action] } }
//
// Action vocabulary:
//   {t:"hold", ms}
//   {t:"cmove", x, y}              move drawn cursor to page coords
//   {t:"hoverJs", find}            locate by named locator, bezier-travel there
//   {t:"clickJs", find}            locate, bezier-travel, click ring + REAL CDP mouse click
//   {t:"domClick", find}           locate, travel, element.click() (fallback when CDP click is blocked)
//   {t:"nav", label}               nav link by exact text (generic locator)
//   {t:"clickText", text}          first button/a whose trimmed text matches (generic)
//   {t:"row", prefix, minW?}       row/anchor whose text starts with prefix, wide enough (generic)
//   {t:"typeJs", find, text, gapMs}  per-char React-safe typing (native setter + input events)
//   {t:"wheel", dy}
//   {t:"waitText", re, notRe?, timeoutMs?}
//
// Design rules baked in (from the 2026-09-03 Tape session):
//   - The drawn cursor is the only cursor: zero OS coordinate math, clicks can't miss.
//   - clickJs uses CDP Input.dispatchMouseEvent (real event: hover/focus/React fire);
//     el.click() is only the fallback. Real OS clicks also drive React fine — past
//     failures were stale window offsets, not React.
//   - Window rect comes from CDP Browser.getWindowForTarget (never System Events
//     assumptions); region capture means foreign windows/Spaces cannot enter frame.
//   - The scene runs silent and is padded to beat-<n>.wav duration; mux trims to beat.
import { spawn, execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync, mkdirSync } from "node:fs";

const CONFIG_PATH = process.argv[2];
const N = process.argv[3];
const MODE = process.argv[4] || "take";
if (!CONFIG_PATH || !N) { console.error("usage: scene-take.mjs <config.json> <n> [check|prep|take]"); process.exit(1); }
const CONFIG = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
const SCENE = CONFIG.scenes[String(N)];
if (!SCENE) { console.error(`no scene ${N} in config`); process.exit(1); }

const BASE = CONFIG.driver || "http://127.0.0.1:9333";
const CDP = CONFIG.cdp || "http://127.0.0.1:9222";
const VO = `${CONFIG.voDir}/beat-${N}.wav`;
const RAW = `${CONFIG.outDir}/scene${N}-raw.mov`;
const OUT = `${CONFIG.outDir}/scene${N}.mp4`;

const R = async (p) => {
  // driver requests must never hang a take: abort + one retry (driver self-heals
  // its CDP socket between attempts); second failure kills the take loudly
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await (await fetch(BASE + p, { signal: AbortSignal.timeout(12000) })).json();
    } catch (e) {
      if (attempt === 1) throw new Error(`driver unreachable (${p.split("&")[0]}): ${String(e).slice(0, 80)}`);
      console.log(`[scene ${N}] driver request failed (${String(e).slice(0, 60)}), retrying...`);
      await sleep(2500);
    }
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;
const say = console.log.bind(console, `[scene ${N}]`);
const beatDur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${VO}`).toString());

// ---------- locators ----------
const GENERIC = {
  h1: `document.querySelector("h1")`,
  input: `document.querySelector('input[type="text"],input:not([type])')`,
};
const locatorExpr = (name) => {
  if (CONFIG.locators && CONFIG.locators[name]) return CONFIG.locators[name];
  if (GENERIC[name]) return GENERIC[name];
  throw new Error(`unknown locator "${name}" (add it to config.locators)`);
};
const findJs = (name) =>
  `(function(){ const el=${locatorExpr(name)}; if(!el) return "nf"; const r=el.getBoundingClientRect(); return (r.x+r.width/2|0)+","+(r.y+r.height/2|0); })()`;
const navJs = (label) =>
  `(function(){ const a=[...document.querySelectorAll("nav a,header a")].find(x=>x.textContent.trim()==="${label}"); if(!a) return "nf"; const r=a.getBoundingClientRect(); return (r.x+r.width/2|0)+","+(r.y+r.height/2|0); })()`;
const clickTextJs = (text) =>
  `(function(){ const b=[...document.querySelectorAll("button,a,[role=button]")].find(x=>x.textContent.trim()==="${text}"); if(!b) return "nf"; const r=b.getBoundingClientRect(); return (r.x+r.width/2|0)+","+(r.y+r.height/2|0); })()`;
const rowJs = (prefix, minW) =>
  `(function(){ const e=[...document.querySelectorAll("a,button,tr,[role=button],div,li")].find(x=>x.textContent.trim().startsWith("${prefix}")&&x.getBoundingClientRect().width>${minW || 600}&&x.getBoundingClientRect().height<70); if(!e) return "nf"; const r=e.getBoundingClientRect(); return (r.x+r.width/2|0)+","+(r.y+r.height/2|0); })()`;

const targetJs = (a) => {
  const t = a.t === "navClick" ? "nav" : a.t === "textClick" ? "clickText" : a.t;
  if (t === "nav") return navJs(a.label);
  if (t === "clickText") return clickTextJs(a.text);
  if (t === "row") return rowJs(a.prefix, a.minW);
  return findJs(a.find);
};

async function evalJs(code) {
  return String((await R(`/eval?page=app&code=${enc(code)}`)).result ?? "nf");
}

// ---------- actions ----------
async function runAction(a) {
  switch (a.t) {
    case "hold": return sleep(a.ms);
    case "cmove": return R(`/cmove?page=app&x=${a.x}&y=${a.y}`);
    case "hoverJs":
    case "nav":
    case "row":
    case "clickText": {
      const pos = await evalJs(targetJs(a));
      if (pos === "nf") { say(`!! hover miss: ${JSON.stringify(a)}`); return; }
      const [x, y] = pos.split(",");
      return R(`/cmove?page=app&x=${x}&y=${y}`);
    }
    case "clickJs": {
      const pos = await evalJs(findJs(a.find));
      if (pos === "nf") { say(`!! clickJs miss: ${a.find}`); return; }
      const [x, y] = pos.split(",");
      return R(`/cclick?page=app&x=${x}&y=${y}`);
    }
    case "domClick": {
      const pos = await evalJs(findJs(a.find));
      if (pos === "nf") { say(`!! domClick miss: ${a.find}`); return; }
      const [x, y] = pos.split(",");
      await R(`/cmove?page=app&x=${x}&y=${y}`);
      await sleep(250);
      return evalJs(`(function(){ const el=${locatorExpr(a.find)}; if(!el) return "nf"; el.click(); return "clicked"; })()`);
    }
    case "navClick":
    case "textClick": {
      const pos = await evalJs(targetJs(a));
      if (pos === "nf") { say(`!! click miss: ${JSON.stringify(a)}`); return; }
      const [x, y] = pos.split(",");
      return R(`/cclick?page=app&x=${x}&y=${y}`);
    }
    case "typeJs": {
      // wpm: human-paced typing. Average typist ~40wpm = 200-300ms per
      // keystroke; delay = 60/(wpm*5) s with +-40% jitter, a longer beat at
      // separators (-._ space), and a 6% chance of a brief think-pause.
      // Without wpm, falls back to the fixed gapMs (default 220).
      const base = a.wpm ? 60 / (a.wpm * 5) : null;
      const gapAfter = (ch) => {
        if (!base) return a.gapMs ?? 220;
        let d = base * (0.6 + Math.random() * 0.8);
        if (ch && "-._ ".includes(ch)) d += 0.08 + Math.random() * 0.14;
        if (Math.random() < 0.06) d += 0.25 + Math.random() * 0.3;
        return d * 1000;
      };
      for (let i = 1; i <= a.text.length; i++) {
        await evalJs(`(function(){ const el=${locatorExpr(a.find)}; if(!el) return "nf"; const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; set.call(el, ${JSON.stringify(a.text.slice(0, i))}); el.dispatchEvent(new Event('input',{bubbles:true})); return "ok"; })()`);
        await sleep(gapAfter(a.text[i - 1]));
      }
      return;
    }
    case "wheel": {
      // smooth scroll: chunk the delta so one big wheel event never jumps
      let remaining = a.dy;
      const sgn = Math.sign(a.dy);
      while (Math.abs(remaining) > 0) {
        const chunk = sgn * Math.min(Math.abs(remaining), 400);
        await R(`/wheel?page=app&dy=${chunk}`);
        remaining -= chunk;
        if (Math.abs(remaining) > 0) await sleep(30);
      }
      await sleep(250);
      return;
    }
    case "scrollTo": {
      // find by container innerText (split text nodes ok), center in viewport
      // with SMOOTH behavior, wait for the scroll to settle, read back scrollY
      const code = `(() => { const el = [...document.querySelectorAll("article,section,div,p,li,summary")].find(e => e.innerText && e.innerText.toLowerCase().includes(${JSON.stringify(a.find.toLowerCase())})); if (!el) return JSON.stringify({found:false}); el.scrollIntoView({behavior:"smooth", block:"center"}); return JSON.stringify({found:true}); })()`;
      const res = await evalJs(code);
      let parsed = {}; try { parsed = JSON.parse(res); } catch {}
      if (!parsed.found) { say(`!! scrollTo miss: /${a.find}/`); return; }
      let last = -1;
      for (let i = 0; i < 20; i++) {
        await sleep(150);
        const cur = await evalJs(`Math.round(scrollY)`);
        if (cur === last) break;
        last = cur;
      }
      say(`scrollTo ${a.find} -> scrollY ${last}`);
      return;
    }
    case "goto": return R(`/goto?page=app&url=${enc(a.url)}`);
    case "waitText": {
      const t0 = Date.now();
      for (;;) {
        const txt = (await evalJs(`document.body.innerText.slice(0,40000)`)) || "";
        if (new RegExp(a.re, "i").test(txt)) return;
        if (a.notRe && new RegExp(a.notRe, "i").test(txt)) return;
        if (Date.now() - t0 > (a.timeoutMs ?? 12000)) { say(`!! waitText timeout /${a.re}/`); return; }
        await sleep(500);
      }
    }
    default: throw new Error(`unknown action ${a.t}`);
  }
}

// ---------- window rect: driver /rect (CDP, instance-safe). No blind fallback:
// with multiple Chrome instances System Events guesses wrong and records the
// wrong window - a wrong region must abort the take, not silently mis-frame it.
async function windowRect() {
  const r = await R(`/rect?page=app`);
  if (!r || r.error || !r.w) throw new Error(`no window rect from driver: ${JSON.stringify(r).slice(0, 120)}`);
  return { x: r.x, y: r.y, w: r.w, h: r.h, via: "driver-cdp" };
}

// ---------- recorder ----------
// This macOS captures the real pointer in region video even without -C; park it
// OUTSIDE the recorded region (top strip above the window) or it photobombs as a
// second frozen arrow.
function parkCursor() {
  const park = CONFIG.cursorPark || "1709,60";
  try {
    execSync(`cliclick m:${park}`);
    const at = execSync(`cliclick p`).toString().trim();
    if (!at.includes("1709") && !at.includes("1710")) say(`!! park readback ${at} != target`);
    else say(`os cursor parked (hidden) at ${at}`);
  }
  catch { say(`!! cliclick missing - os cursor NOT parked, it may appear on camera`); }
}

async function killStrayRecorders() {
  const t0 = Date.now();
  for (;;) {
    const pids = execSync(`ps aux | grep '[s]creencapture -v' | awk '{print $2}'`).toString().trim().split("\n").filter(Boolean);
    if (!pids.length) return;
    for (const pid of pids) { try { process.kill(parseInt(pid, 10), "SIGINT"); } catch {} }
    if (Date.now() - t0 > 8000) throw new Error("stray recorders refuse to die");
    await sleep(1500);
  }
}

async function startRecorder() {
  mkdirSync(CONFIG.outDir, { recursive: true });   // screencapture cannot flush into a missing dir
  await killStrayRecorders();
  parkCursor();
  const { x, y, w, h, via } = await windowRect();
  say(`recording region ${x},${y} ${w}x${h} (${via})`);
  try { rmSync(RAW); } catch {}
  const p = spawn("screencapture", ["-v", `-R${x},${y},${w},${h}`, RAW], { detached: true, stdio: "ignore" });
  p.unref();
  await sleep(1500);
  const alive = execSync(`ps aux | grep "[s]creencapture -v" | wc -l`).toString().trim() !== "0";
  if (!alive) throw new Error("recorder died at start");
}

// avfoundation path: screencapture -v can silently deliver a fraction of wall
// time (2026-09-06 Rushes: 17s mov for a 28s window, ~16.7fps; standalone
// 12s test -> 7.5s) while `ffmpeg -f avfoundation` holds a clean 30.0fps.
// Config: "recorder": "avfoundation", optional "avDevice" (screen index),
// "avScale" (rect points -> capture pixels; Retina = 2).
async function startRecorderAv(x, y, w, h) {
  try { rmSync(RAW); } catch {}
  const s = CONFIG.avScale || 1;
  const args = ["-y", "-v", "error", "-f", "avfoundation",
    "-framerate", "30", "-video_device_index", String(CONFIG.avDevice ?? 2), "-i", "",
    "-vf", `crop=${Math.round(w * s)}:${Math.round(h * s)}:${Math.round(x * s)}:${Math.round(y * s)}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p", RAW];
  const p = spawn("ffmpeg", args, { detached: true, stdio: "ignore" });
  p.unref();
  await sleep(2500);
  const alive = execSync(`pgrep -f "avfoundation.*scene${N}-raw" | wc -l`).toString().trim() !== "0";
  if (!alive) throw new Error("av recorder died at start");
}

async function stopRecorderAv() {
  const pg = (pat) => { try { return execSync(pat).toString().trim().split("\n").filter(Boolean); } catch { return []; } };
  let pids = pg(`pgrep -f "avfoundation.*scene${N}-raw"`);
  for (const pid of pids) { try { process.kill(parseInt(pid, 10), "SIGINT"); } catch {} }
  say(`stopped av recorder (${pids.length}), flushing...`);
  const t0 = Date.now();
  while (pids.length && Date.now() - t0 < 20000) {
    await sleep(500);
    pids = pg(`pgrep -f "avfoundation.*scene${N}-raw"`);
  }
  if (!existsSync(RAW)) throw new Error("av recorder never flushed " + RAW);
  await sleep(800);
}

async function stopRecorder() {
  const pids = execSync(`ps aux | grep '[s]creencapture -v' | awk '{print $2}'`).toString().trim().split("\n").filter(Boolean);
  for (const pid of pids) { try { process.kill(parseInt(pid, 10), "SIGINT"); } catch {} }
  say(`stopped recorder (${pids.length}), flushing...`);
  const t0 = Date.now();
  while (!existsSync(RAW) && Date.now() - t0 < 20000) await sleep(500);
  if (!existsSync(RAW)) throw new Error("recorder never flushed " + RAW);
  await sleep(1200);
}

function convert() {
  execSync(`ffmpeg -y -i ${RAW} -c:v libx264 -preset ultrafast -crf 20 -an ${OUT} 2>/dev/null`);
  const d = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${OUT}`).toString());
  say(`scene${N}.mp4 ${d.toFixed(2)}s vs beat ${beatDur.toFixed(2)}s ${d >= beatDur ? "OK" : "!! SHORT - lengthen holds"}`);
  return d;
}

// ---------- modes ----------
const DRY = MODE === "dry";
const runAll = async (list) => {
  for (const a of list) {
    if (DRY && a.t === "hold") { await sleep(Math.min(a.ms, 400)); continue; }
    await runAction(a);
  }
};

(async () => {
  if (MODE === "check") {
    if (SCENE.prep) { for (const a of SCENE.prep) await runAction(a); await sleep(1200); }
    for (const a of [...(SCENE.prep || []), ...SCENE.actions]) {
      if (!["hoverJs", "clickJs", "domClick", "typeJs", "nav", "clickText", "row", "navClick", "textClick"].includes(a.t)) continue;
      const pos = await evalJs(targetJs(a));
      console.log(`  ${a.t}${a.find ? ":" + a.find : a.label ? ":" + a.label : a.text ? ":" + a.text : a.prefix ? ":" + a.prefix : ""} -> ${pos}`);
    }
    console.log("url now:", await evalJs(`location.pathname`));
    return;
  }

  say(`beat ${beatDur.toFixed(2)}s, ${SCENE.actions.length} actions, mode ${MODE}`);
  if (SCENE.prep) {
    say("prep...");
    await runAll(SCENE.prep);
    await sleep(800);
  }
  if (MODE === "prep") return say("prep done");
  if (DRY) {
    const t0 = Date.now();
    await runAll(SCENE.actions);
    let est = 0;
    for (const a of SCENE.actions) {
      if (a.t === "hold") est += (a.ms ?? 0) / 1000;
      else if (a.t === "wheel") est += Math.ceil(Math.abs(a.dy) / 400) * 0.18 + 0.25;
      else if (a.t === "scrollTo") est += 1.4;
      else if (a.t === "goto") est += 2.0;
      else est += 0.6;
    }
    say(`DRY complete in ${((Date.now() - t0) / 1000).toFixed(1)}s (real holds would fill ${beatDur.toFixed(1)}s)`);
    say(`pacing: actions ~${est.toFixed(1)}s vs beat ${beatDur.toFixed(1)}s ${est <= beatDur ? "FITS" : "OVER by " + (est - beatDur).toFixed(1) + "s: trim holds or cut a scroll"}`);
    return;
  }

  const useAv = CONFIG.recorder === "avfoundation";
  if (useAv) {
    mkdirSync(CONFIG.outDir, { recursive: true });
    await parkCursor();
    const r = await windowRect();
    say(`recording region ${r.x},${r.y} ${r.w}x${r.h} (avfoundation)`);
    await startRecorderAv(r.x, r.y, r.w, r.h);
  } else {
    await startRecorder();
  }
  try {
    const t0 = Date.now();
    for (const a of SCENE.actions) await runAction(a);
    const elapsed = Date.now() - t0;
    const remain = beatDur * 1000 + 1500 - elapsed;
    if (remain > 0) { say(`padding ${Math.round(remain / 100) / 10}s`); await sleep(remain); }
    else say(`!! OVERRAN beat by ${(-remain / 1000).toFixed(1)}s`);
    if (useAv) await stopRecorderAv(); else await stopRecorder();
  } catch (e) {
    say(`TAKE FAILED: ${String(e).slice(0, 120)} - stopping recorder`);
    try { if (useAv) await stopRecorderAv(); else await stopRecorder(); } catch {}
    throw e;
  }
  convert();
})();
