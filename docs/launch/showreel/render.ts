/**
 * ADR-0090: renders `showreel.html` to an MP4, frame by frame, with its synthesised soundtrack.
 *   bun docs/launch/showreel/render.ts                      # the full 180 s at 30 fps → out/remora-showreel.mp4
 *   bun docs/launch/showreel/render.ts --stills 6,24,60     # PNG stills at those seconds → out/still-*.png
 *   bun docs/launch/showreel/render.ts --from 40 --to 70    # a section, for review
 * Needs ffmpeg with libx264, and the Chromium that the e2e workspace's Playwright installs.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
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
const FPS = 30;
const DUR = 180;
const WORKERS = Number(arg("workers") ?? 4);
const url = `file://${join(HERE, "showreel.html")}?render=1`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const open = async () => {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  await page.goto(url);
  await page.evaluate(() => (window as unknown as { ready: Promise<boolean> }).ready);
  return page;
};
const at = async (page: Awaited<ReturnType<typeof open>>, t: number) => {
  await page.evaluate((s) => (window as unknown as { render: (t: number) => void }).render(s), t);
};

/** The soundtrack, rendered offline in the page, copied out in chunks (raw s16le, 48 kHz stereo). */
async function pcmFrom(page: Awaited<ReturnType<typeof open>>) {
  const bytes = await page.evaluate(() =>
    (window as unknown as { renderAudio: (sr: number) => Promise<number> }).renderAudio(48000),
  );
  const CHUNK = 4 * 1024 * 1024;
  const parts: Buffer[] = [];
  for (let i = 0; i * CHUNK < bytes; i++) {
    const b64 = await page.evaluate(
      ([k, size]) =>
        (window as unknown as { pcmChunk: (i: number, s: number) => string }).pcmChunk(k, size),
      [i, CHUNK] as const,
    );
    parts.push(Buffer.from(b64, "base64"));
  }
  return Buffer.concat(parts);
}
const ffmpeg = (args: string[]) =>
  new Promise<void>((ok, fail) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("exit", (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}`))));
  });

const stills = arg("stills");
if (stills) {
  const page = await open();
  for (const s of stills.split(",").map(Number)) {
    await at(page, s);
    await page.screenshot({ path: join(OUT, `still-${String(s).replace(".", "_")}.png`) });
    console.log(`still ${s}s`);
  }
  await browser.close();
  process.exit(0);
}

// The soundtrack alone, for a listen: out/soundtrack.wav.
if (process.argv.includes("--audio")) {
  const page = await open();
  const pcm = await pcmFrom(page);
  writeFileSync(join(OUT, "audio.raw"), pcm);
  await browser.close();
  await ffmpeg([
    "-y",
    "-loglevel",
    "error",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-i",
    join(OUT, "audio.raw"),
    join(OUT, "soundtrack.wav"),
  ]);
  console.log(`wrote ${join(OUT, "soundtrack.wav")} (${(pcm.length / 4 / 48000).toFixed(1)} s)`);
  process.exit(0);
}

const from = Number(arg("from") ?? 0);
const to = Number(arg("to") ?? DUR);
const frames = Math.round((to - from) * FPS);
const dir = join(OUT, "frames");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// Frames, split into contiguous chunks across pages.
const t0 = Date.now();
let done = 0;
const per = Math.ceil(frames / WORKERS);
await Promise.all(
  Array.from({ length: WORKERS }, async (_, w) => {
    const page = await open();
    for (let f = w * per; f < Math.min(frames, (w + 1) * per); f++) {
      await at(page, from + f / FPS);
      await page.screenshot({
        path: join(dir, `${String(f).padStart(5, "0")}.jpg`),
        type: "jpeg",
        quality: 92,
      });
      if (++done % 150 === 0) {
        const rate = done / ((Date.now() - t0) / 1000);
        console.log(
          `${done}/${frames} frames · ${rate.toFixed(1)} fps · ~${Math.round((frames - done) / rate)} s left`,
        );
      }
    }
  }),
);

const pcm = await pcmFrom(await open());
const offset = Math.round(from * 48000) * 4;
writeFileSync(
  join(OUT, "audio.raw"),
  pcm.subarray(offset, offset + Math.round((to - from) * 48000) * 4),
);
await browser.close();
console.log(`audio: ${(pcm.length / 4 / 48000).toFixed(1)} s`);

const name = from === 0 && to === DUR ? "remora-showreel.mp4" : `remora-showreel-${from}-${to}.mp4`;
await ffmpeg([
  "-y",
  "-loglevel",
  "error",
  "-framerate",
  String(FPS),
  "-i",
  join(dir, "%05d.jpg"),
  "-f",
  "s16le",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-i",
  join(OUT, "audio.raw"),
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "17",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-af",
  "loudnorm=I=-14:TP=-1.5:LRA=11",
  // loudnorm resamples internally; keep the delivery at 48 kHz.
  "-ar",
  "48000",
  "-c:a",
  "aac",
  "-b:a",
  "256k",
  "-shortest",
  join(OUT, name),
]);
console.log(`wrote ${join(OUT, name)} in ${Math.round((Date.now() - t0) / 1000)} s`);

// A lighter copy for the web (X, the blog, the form's link): ~40 MB instead of ~330 MB.
const web = name.replace(".mp4", "-web.mp4");
await ffmpeg([
  "-y",
  "-loglevel",
  "error",
  "-i",
  join(OUT, name),
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "24",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "copy",
  "-movflags",
  "+faststart",
  join(OUT, web),
]);
console.log(`wrote ${join(OUT, web)}`);
