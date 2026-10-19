/**
 * Writes the static logo files from the component's geometry (ADR-0040): the two flat SVGs, the
 * favicon (an indigo tile), the PNG icons and the 1200×630 share image (`og.png`). PNGs are
 * rendered with the e2e package's Playwright.
 *
 *   bun run --filter @remora/web logo:assets
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { LOGO_PATH, LOGO_VIEWBOX } from "../src/components/logo-path";

/** `--primary` in light mode, oklch(0.55 0.22 280), as sRGB for files that can't read CSS. */
const PRIMARY = "#6054ec";
const PUBLIC = join(import.meta.dir, "..", "public");

const flat = (fill: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}"><path fill="${fill}" d="${LOGO_PATH}"/></svg>\n`;

/** A rounded tile with the glyph inset 20%, the same proportions as `<Logo background>`. */
const tile = (bg: string, fg: string, radius = 0.24) => {
  const inner = 1 - 0.2 * 2;
  const offset = (1 - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${512 * radius}" fill="${bg}"/><svg x="${512 * offset}" y="${512 * offset}" width="${512 * inner}" height="${512 * inner}" viewBox="${LOGO_VIEWBOX}"><path fill="${fg}" d="${LOGO_PATH}"/></svg></svg>\n`;
};

writeFileSync(join(PUBLIC, "logo-black.svg"), flat("#000000"));
writeFileSync(join(PUBLIC, "logo-white.svg"), flat("#FFFFFF"));
writeFileSync(join(PUBLIC, "favicon.svg"), tile(PRIMARY, "#FFFFFF"));

const require = createRequire(join(import.meta.dir, "..", "..", "..", "e2e", "package.json"));
const { chromium } = require("@playwright/test") as typeof import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage();
// Apple and Android mask the corners themselves, so their icons are full-bleed squares.
const PNGS: Array<[string, number, number]> = [
  ["favicon-32.png", 32, 0.24],
  ["apple-touch-icon.png", 180, 0],
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
];
for (const [name, size, radius] of PNGS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${tile(PRIMARY, "#FFFFFF", radius)}`,
  );
  await page.screenshot({ path: join(PUBLIC, name), omitBackground: true });
}

// The link preview: the tile and word on warm dark paper, the hero line, the three promises.
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html><head><style>
  body{margin:0;width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;
    background:radial-gradient(900px 500px at 100% 0%,rgba(96,84,236,.35),transparent 60%),#1f1e1c;color:#f5f4f0;
    font-family:Inter,"SF Pro Display",system-ui,sans-serif}
  .brand{display:flex;align-items:center;gap:20px;font-size:44px;font-weight:600;letter-spacing:-.02em}
  .brand svg{width:72px;height:72px}
  h1{margin:0;font-size:84px;line-height:1.02;font-weight:650;letter-spacing:-.035em}
  p{margin:20px 0 0;font-size:30px;color:#b9b6ad}
  .chips{display:flex;gap:12px}
  .chip{border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:10px 20px;font-size:22px;color:#d8d5cc}
</style></head><body>
  <div class="brand">${tile(PRIMARY, "#FFFFFF")}remora</div>
  <div><h1>Always-on agents<br/>you own.</h1><p>Memory you can read · a budget Sui enforces · a receipt for every action.</p></div>
  <div class="chips"><span class="chip">Walrus Memory</span><span class="chip">Sui</span><span class="chip">Web · Telegram</span></div>
</body></html>`);
await page.screenshot({ path: join(PUBLIC, "og.png") });
await browser.close();
console.log("logo assets written to public/");
