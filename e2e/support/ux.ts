/**
 * U14 (ADR-0103): the review capture. `UX=1` adds the `ux-desktop` (1440×900) and `ux-phone`
 * (Pixel 7) projects, which run the UX tests in `audit.spec.ts`: every route, tab and state, shot
 * into `docs/ux/review/r<UX_ROUND>/<device>/`, plus `words.json`, the interface words each page shows.
 *
 * Words are counted in the main pane (`[data-slot=sidebar-inset]`), not the rail or the roster.
 * User and agent content doesn't count (`[data-ux-skip]`, chat bubbles, rendered Markdown), and
 * neither do numbers, amounts, addresses or digests.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Page, TestInfo } from "@playwright/test";

export const UX = process.env.UX === "1";
const ROUND = process.env.UX_ROUND ?? "0";
/** Round 3 adds the light theme (`UX_THEME=light`); every other shot is dark. */
export const THEME: "dark" | "light" = process.env.UX_THEME === "light" ? "light" : "dark";

const ROOT = resolve(import.meta.dirname, "../..");

export type Words = { above: number; total: number };

export function uxDir(info: TestInfo): string {
  const device = info.project.name === "ux-phone" ? "phone" : "desktop";
  const dir = resolve(
    ROOT,
    `docs/ux/review/r${ROUND}/${THEME === "light" ? "light-" : ""}${device}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Counted in the page: visible text nodes in the main pane, minus content and data tokens. */
export async function countWords(page: Page): Promise<Words> {
  return page.evaluate(() => {
    const root =
      document.querySelector('[data-slot="sidebar-inset"]') ??
      document.querySelector("main") ??
      document.body;
    const SKIP =
      '[data-ux-skip],[data-slot="bubble-content"],.message-markdown,script,style,noscript,.sr-only,[aria-hidden="true"]';
    const dataToken = (raw: string) => {
      const w = raw.replace(/^[("“'[]+|[)"”'\].,:;!?]+$/g, "");
      if (!w || !/[A-Za-z]/.test(w)) return true; // a number, an amount, a time
      if (/^0x[0-9a-f]+/i.test(w) || /…/.test(w)) return true; // an address or a shortened digest
      if (/^[A-Za-z0-9_-]{20,}$/.test(w)) return true; // a digest or a blob id
      if (/^\d/.test(w) && w.length <= 6) return true; // 12h, 3d, 2.5k
      return /^(USDC|SUI|WAL|\$\S*)$/.test(w);
    };
    const fold = window.innerHeight;
    let above = 0;
    let total = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent ?? "";
      if (!el || !text.trim() || el.closest(SKIP)) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || Number(style.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const words = text.split(/\s+/).filter((w) => w && !dataToken(w)).length;
      total += words;
      if (rect.top < fold && rect.bottom > 0) above += words;
    }
    return { above, total };
  });
}

/** The tallest scroll area in the page, so a full shot shows what the inner scroller hides. */
async function contentHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    // Only the main pane's scroll areas: the roster can be far longer than the page.
    const main = document.querySelector('[data-slot="sidebar-inset"]') ?? document.body;
    let max = document.documentElement.scrollHeight;
    for (const el of Array.from(main.querySelectorAll<HTMLElement>("*"))) {
      if (el.scrollHeight <= el.clientHeight + 4) continue;
      const overflow = getComputedStyle(el).overflowY;
      if (overflow !== "auto" && overflow !== "scroll") continue;
      const top = el.getBoundingClientRect().top;
      max = Math.max(
        max,
        Math.ceil(top + el.scrollHeight + (window.innerHeight - el.getBoundingClientRect().bottom)),
      );
    }
    return Math.min(max, 9000);
  });
}

/** Above the fold as `<name>.jpg`; the whole page as `<name>.full.jpg` when it's taller. */
export async function shoot(
  page: Page,
  info: TestInfo,
  name: string,
  words: Record<string, Words>,
): Promise<void> {
  const dir = uxDir(info);
  words[name] = await countWords(page);
  await page.screenshot({ path: `${dir}/${name}.jpg`, type: "jpeg", quality: 72 });
  const size = page.viewportSize();
  if (!size) return;
  const height = await contentHeight(page);
  if (height > size.height + 40) {
    await page.setViewportSize({ width: size.width, height });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dir}/${name}.full.jpg`, type: "jpeg", quality: 72 });
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
  }
}

/** Merges this test's counts into the device's `words.json`. */
export function saveWords(info: TestInfo, words: Record<string, Words>): void {
  const file = `${uxDir(info)}/words.json`;
  let prev: Record<string, Words> = {};
  try {
    prev = JSON.parse(readFileSync(file, "utf8"));
  } catch {}
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ ...prev, ...words }, null, 2)}\n`);
}
