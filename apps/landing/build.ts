/**
 * ADR-0092: builds the landing page into dist/, the folder Walrus Sites publishes (H6).
 *   bun run --filter @remora/landing build
 * It copies public/, the screens (committed in public/screens), the share image, and the demo video
 * with its poster when docs/launch/demo has rendered them. Without the video, the page links to the
 * repo instead.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HERE = resolve(import.meta.dirname);
const ROOT = resolve(HERE, "../..");
const DIST = join(HERE, "dist");

rmSync(DIST, { recursive: true, force: true });
cpSync(join(HERE, "public"), DIST, { recursive: true });
cpSync(join(ROOT, "apps/web/public/og.png"), join(DIST, "og.png"));

const video = join(ROOT, "docs/launch/demo/out/remora-demo-web.mp4");
const thumbnail = join(ROOT, "docs/launch/demo/out/thumbnail.jpg");
if (existsSync(video)) {
  mkdirSync(join(DIST, "media"), { recursive: true });
  cpSync(video, join(DIST, "media/remora-demo.mp4"));
  // The poster: the video's own thumbnail (ADR-0093), else its hook frame.
  const poster = join(DIST, "screens/demo-poster.jpg");
  let ok = existsSync(thumbnail);
  if (ok) cpSync(thumbnail, poster);
  else {
    const args = ["-y", "-loglevel", "error", "-ss", "4.2", "-i", video, "-frames:v", "1", poster];
    ok = spawnSync("ffmpeg", args).status === 0;
  }
  console.log(ok ? "video + poster" : "video (no poster: ffmpeg failed)");
} else {
  console.log("no demo video yet: render it with `bun docs/launch/demo/render.ts`");
}

// Walrus Sites: cache the assets hard, keep the page fresh.
writeFileSync(
  join(DIST, "ws-resources.json"),
  `${JSON.stringify(
    {
      site_name: "Remora",
      headers: {
        "/index.html": { "Cache-Control": "max-age=300" },
        "/config.js": { "Cache-Control": "max-age=300" },
      },
    },
    null,
    2,
  )}\n`,
);
console.log(`built ${DIST}`);
