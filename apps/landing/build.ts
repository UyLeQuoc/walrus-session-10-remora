/**
 * ADR-0092: builds the landing page into dist/, the folder Walrus Sites publishes (H6).
 *   bun run --filter @remora/landing build
 * It copies public/, the screens (committed in public/screens), the share image, and the demo video
 * with its poster when docs/launch/demo has rendered them. Without the video, the page links to the
 * repo instead.
 *
 * ADR-0100: `--into <dir>` writes it into the web app's build instead, so one site serves both: the
 * page becomes `landing.html` next to the app, its links stay on that origin, and the app's own
 * favicon and share image are kept.
 *   bun apps/landing/build.ts --into apps/web/dist
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HERE = resolve(import.meta.dirname);
const ROOT = resolve(HERE, "../..");
const at = process.argv.indexOf("--into");
const into = at > 0 ? process.argv[at + 1] : undefined;
if (at > 0 && !into) throw new Error("usage: build.ts [--into <dir>]");
const DIST = into ? resolve(into) : join(HERE, "dist");

if (into) {
  if (!existsSync(join(DIST, "app.html")))
    throw new Error(`${DIST} has no app.html to sit next to`);
  for (const f of ["config.js", "screens"])
    cpSync(join(HERE, "public", f), join(DIST, f), { recursive: true });
  cpSync(join(HERE, "public/index.html"), join(DIST, "landing.html"));
  // Same origin: the buttons open this site's playground and chat.
  const config = readFileSync(join(DIST, "config.js"), "utf8").replace(
    /^ {2}app: .*$/m,
    "  app: location.origin,",
  );
  writeFileSync(join(DIST, "config.js"), config);
} else {
  rmSync(DIST, { recursive: true, force: true });
  cpSync(join(HERE, "public"), DIST, { recursive: true });
  cpSync(join(ROOT, "apps/web/public/og.png"), join(DIST, "og.png"));
}

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

if (!into) {
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
}
console.log(`built ${into ? join(DIST, "landing.html") : DIST}`);
