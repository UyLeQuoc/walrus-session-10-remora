/**
 * ADR-0091 and ADR-0093: renders `demo.html` to video, frame by frame, the way WalForm's videos are made.
 *   bun docs/launch/demo/render.ts                      # the full video → out/ (see below)
 *   bun docs/launch/demo/render.ts --stills 6,24,60     # PNG stills at those seconds → out/still-*.png
 *   bun docs/launch/demo/render.ts --sheet 24           # a contact sheet of 24 moments → out/contact-sheet.jpg
 *   bun docs/launch/demo/render.ts --audio              # the soundtrack alone → out/soundtrack.wav
 *   bun docs/launch/demo/render.ts --from 40 --to 70    # a section, for review
 *   bun docs/launch/demo/render.ts --sub 1 --fps 30     # a quick draft without motion blur
 * The full render writes:
 *   - remora-demo.mp4, the master: 1080p60, motion blur from 4 sub-frames per frame (shutter 0.5), light
 *     grain, H.264 CRF 16, AAC 320k at -14 LUFS;
 *   - remora-demo-web.mp4, the share copy: 30 fps, `-tune animation`, CRF 24, AAC 128k;
 *   - soundtrack.wav, thumbnail.jpg (1920×1080) and thumbnail-youtube.jpg (1280×720).
 * Needs ffmpeg with libx264, and the Chromium that the e2e workspace's Playwright installs.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const HERE = resolve(import.meta.dirname);
const ROOT = resolve(HERE, "../../..");
const OUT = join(HERE, "out");
const { chromium } = createRequire(join(ROOT, "e2e/package.json"))(
  "@playwright/test",
) as typeof import("@playwright/test");

const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const FPS = Number(arg("fps") ?? 60);
const SUB = Number(arg("sub") ?? 4);
const SHUTTER = 0.5;
let DUR = 180;
const WORKERS = Number(arg("workers") ?? 6);
const url = `file://${join(HERE, "demo.html")}?render=1`;

mkdirSync(OUT, { recursive: true });
// The capture's manifests, as a script the page can load from file:// (fetch can't).
const CAPTURE = join(HERE, "capture");
const shots: Record<string, unknown> = {};
for (const d of readdirSync(CAPTURE, { withFileTypes: true })) {
  const m = join(CAPTURE, d.name, "manifest.json");
  // A shot folder may be a link to another checkout's capture (a re-cut that films one new shot).
  if ((d.isDirectory() || d.isSymbolicLink()) && existsSync(m))
    shots[d.name] = JSON.parse(readFileSync(m, "utf8"));
}
writeFileSync(join(CAPTURE, "index.js"), `window.CAPTURE = ${JSON.stringify(shots)};\n`);
console.log(`capture: ${Object.keys(shots).join(", ")}`);

type Page = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>["newPage"]>>;
type DemoWindow = {
  ready: Promise<boolean>;
  render: (t: number) => Promise<void>;
  DUR: number;
  GLITCH: [number, number][];
  THUMB: number;
  renderAudio: (sr: number) => Promise<number>;
  pcmChunk: (i: number, s: number) => string;
};

const browser = await chromium.launch();
const open = async () => {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on("console", (m) => m.type() === "warning" && console.warn(`page: ${m.text()}`));
  page.on("pageerror", (e) => console.error(`page error: ${e.message}`));
  await page.goto(url);
  await page.evaluate(() => (window as unknown as DemoWindow).ready);
  return page;
};
// render(t) resolves once the footage frame is decoded.
const at = (page: Page, t: number) =>
  page.evaluate((s) => (window as unknown as DemoWindow).render(s), t);

// The edit's length comes from the footage, so the page says how long the video is.
const probe = await open();
DUR = await probe.evaluate(() => (window as unknown as DemoWindow).DUR);
const GLITCH = await probe.evaluate(() => (window as unknown as DemoWindow).GLITCH);
const THUMB = await probe.evaluate(() => (window as unknown as DemoWindow).THUMB);
console.log(`duration: ${DUR.toFixed(1)} s`);

/** The soundtrack, rendered offline in the page, copied out in chunks (raw s16le, 48 kHz stereo). */
async function pcmFrom(page: Page) {
  const bytes = await page.evaluate(() => (window as unknown as DemoWindow).renderAudio(48000));
  const CHUNK = 4 * 1024 * 1024;
  const parts: Buffer[] = [];
  for (let i = 0; i * CHUNK < bytes; i++) {
    const b64 = await page.evaluate(
      ([k, size]) => (window as unknown as DemoWindow).pcmChunk(k, size),
      [i, CHUNK] as const,
    );
    parts.push(Buffer.from(b64, "base64"));
  }
  return Buffer.concat(parts);
}
const ffmpeg = (args: string[], stdin = false) => {
  const ff = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: [stdin ? "pipe" : "ignore", "inherit", "inherit"],
  });
  const done = new Promise<void>((ok, fail) =>
    ff.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`)))),
  );
  return Object.assign(done, { ff });
};

/** The soundtrack at -14 LUFS, 48 kHz, cut to [from, to]. */
async function soundtrack(page: Page, from: number, to: number, file: string) {
  const pcm = await pcmFrom(page);
  const offset = Math.round(from * 48000) * 4;
  const raw = join(OUT, "audio.raw");
  writeFileSync(raw, pcm.subarray(offset, offset + Math.round((to - from) * 48000) * 4));
  // loudnorm resamples internally; keep the delivery at 48 kHz.
  await ffmpeg([
    ...["-f", "s16le", "-ar", "48000", "-ac", "2", "-i", raw],
    ...["-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", file],
  ]);
  rmSync(raw);
}

const stills = arg("stills");
if (stills) {
  for (const s of stills.split(",").map(Number)) {
    await at(probe, s);
    await probe.screenshot({ path: join(OUT, `still-${String(s).replace(".", "_")}.png`) });
    console.log(`still ${s}s`);
  }
  await browser.close();
  process.exit(0);
}

// A contact sheet: n moments in a grid, to review the whole edit at a glance.
if (process.argv.includes("--sheet")) {
  const n = Number(arg("sheet") ?? 24) || 24;
  const dir = join(OUT, "sheet");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const times: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) * DUR) / n;
    await at(probe, t);
    await probe.screenshot({
      path: join(dir, `${String(i).padStart(3, "0")}.jpg`),
      type: "jpeg",
      quality: 85,
    });
    times.push(t.toFixed(1));
  }
  const cols = 6;
  await ffmpeg([
    ...["-framerate", "1", "-i", join(dir, "%03d.jpg")],
    ...["-vf", `scale=480:-1,pad=iw+8:ih+8:4:4:white,tile=${cols}x${Math.ceil(n / cols)}`],
    ...["-frames:v", "1", "-q:v", "3", join(OUT, "contact-sheet.jpg")],
  ]);
  console.log(`wrote ${join(OUT, "contact-sheet.jpg")} · seconds: ${times.join(", ")}`);
  await browser.close();
  process.exit(0);
}

if (process.argv.includes("--audio")) {
  await soundtrack(probe, 0, DUR, join(OUT, "soundtrack.wav"));
  await browser.close();
  console.log(`wrote ${join(OUT, "soundtrack.wav")}`);
  process.exit(0);
}

const from = Number(arg("from") ?? 0);
const to = Number(arg("to") ?? DUR);
const frames = Math.round((to - from) * FPS);
const segDir = join(OUT, "segments");
rmSync(segDir, { recursive: true, force: true });
rmSync(join(OUT, "frames"), { recursive: true, force: true });
mkdirSync(segDir, { recursive: true });

// Each worker renders a contiguous run of frames into its own lossless-ish segment. A frame is the
// mean of SUB sub-frames spread across half a frame's time (a 180° shutter), so motion blurs the way a
// camera's does. ffmpeg does the averaging: tmix over each group of SUB, then keeps the group's last.
const t0 = Date.now();
let done = 0;
const per = Math.ceil(frames / WORKERS);
const segments = (
  await Promise.all(
    Array.from({ length: WORKERS }, async (_, w) => {
      const a = w * per;
      const b = Math.min(frames, a + per);
      if (a >= b) return null;
      const file = join(segDir, `seg_${String(w).padStart(2, "0")}.mp4`);
      const blur =
        SUB > 1
          ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),`
          : "";
      const enc = ffmpeg(
        [
          ...["-f", "image2pipe", "-c:v", "mjpeg", "-framerate", String(FPS * SUB), "-i", "-"],
          ...["-vf", `${blur}format=yuv444p`, "-r", String(FPS)],
          ...["-c:v", "libx264", "-preset", "medium", "-crf", "9", file],
        ],
        true,
      );
      const page = await open();
      const cdp = await page.context().newCDPSession(page);
      for (let f = a; f < b; f++) {
        for (let k = 0; k < SUB; k++) {
          const off = SUB > 1 ? (k / (SUB - 1) - 0.5) * SHUTTER : 0;
          await at(page, Math.max(0, from + (f + off) / FPS));
          const { data } = await cdp.send("Page.captureScreenshot", {
            format: "jpeg",
            quality: 95,
            optimizeForSpeed: true,
          });
          if (!enc.ff.stdin?.write(Buffer.from(data, "base64")))
            await new Promise((r) => enc.ff.stdin?.once("drain", r));
        }
        if (++done % 300 === 0) {
          const rate = done / ((Date.now() - t0) / 1000);
          console.log(
            `${done}/${frames} frames · ${rate.toFixed(1)} fps · ~${Math.round((frames - done) / rate)} s left`,
          );
        }
      }
      enc.ff.stdin?.end();
      await enc;
      await page.close();
      return file;
    }),
  )
).filter((f): f is string => f !== null);

const video = join(OUT, "video.mp4");
writeFileSync(join(segDir, "list.txt"), segments.map((f) => `file '${f}'`).join("\n"));
await ffmpeg(["-f", "concat", "-safe", "0", "-i", join(segDir, "list.txt"), "-c", "copy", video]);
console.log(`video: ${frames} frames in ${Math.round((Date.now() - t0) / 1000)} s`);

const wav = join(OUT, "soundtrack.wav");
await soundtrack(probe, from, to, wav);

// Thumbnails: the hook, once its headline has landed.
await at(probe, THUMB);
await probe.screenshot({ path: join(OUT, "thumbnail.jpg"), type: "jpeg", quality: 92 });
await browser.close();
await ffmpeg([
  ...["-i", join(OUT, "thumbnail.jpg"), "-vf", "scale=1280:720:flags=lanczos"],
  ...["-q:v", "2", join(OUT, "thumbnail-youtube.jpg")],
]);

const full = from === 0 && to === DUR;
const name = full ? "remora-demo.mp4" : `remora-demo-${from}-${to}.mp4`;
// The master: a short RGB split where a stamp lands, then light film grain.
const glitch = GLITCH.filter(([a]) => a >= from && a < to)
  .map(([a, b]) => `between(t,${(a - from).toFixed(3)},${(b - from).toFixed(3)})`)
  .join("+");
await ffmpeg([
  ...["-i", video, "-i", wav, "-filter_complex"],
  `[0:v]format=gbrp,${glitch ? `rgbashift=rh=-5:bh=5:enable='${glitch}',` : ""}format=yuv420p,noise=c0s=4:c0f=t+u[v]`,
  ...["-map", "[v]", "-map", "1:a", "-shortest"],
  ...[
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "16",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
  ],
  ...["-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-movflags", "+faststart", join(OUT, name)],
]);
console.log(`wrote ${join(OUT, name)}`);

// The share copy (X, the blog, the landing page, the form's link): 30 fps, tuned for flat UI.
const web = name.replace(".mp4", "-web.mp4");
await ffmpeg([
  ...["-i", video, "-i", wav, "-filter_complex", "[0:v]fps=30,format=yuv420p[v]"],
  ...["-map", "[v]", "-map", "1:a", "-shortest"],
  ...["-c:v", "libx264", "-preset", "slower", "-tune", "animation", "-crf", "24"],
  ...["-profile:v", "high", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"],
  join(OUT, web),
]);
console.log(`wrote ${join(OUT, web)} in ${Math.round((Date.now() - t0) / 1000)} s`);
rmSync(segDir, { recursive: true, force: true });
