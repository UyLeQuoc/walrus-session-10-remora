/** Renders the synthetic bills to PNG: `bun apps/server/src/runtime/fixtures/bills/render-bills.ts`. */
import { createRequire } from "node:module";
import { join } from "node:path";
import { BILLS } from "./bills.html.ts";

const req = createRequire(join(import.meta.dirname, "../../../../../../e2e/package.json"));
const { chromium } = req("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 480 }, deviceScaleFactor: 1 });
for (const [name, html] of Object.entries(BILLS)) {
  await page.setContent(html);
  await page.screenshot({ path: join(import.meta.dirname, `${name}.png`), fullPage: true });
  console.log(name);
}
await browser.close();
