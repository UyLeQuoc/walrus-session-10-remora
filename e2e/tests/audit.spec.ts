/**
 * The signed-in audit pass (plan §7.3, follow-up item 11): every page in light and dark, written to
 * `docs/e2e/screenshots/audit-{light,dark}-<page>.png`. Opt in with `AUDIT=1` so the default run
 * does not spend the burner. It only signs in and reads; no payment is made.
 *
 * Besides the static pages it captures a remora's Overview / Activity / Settings tabs (an id read
 * from the API this test is already signed in to), `/connect`, the 404 page, and the signed-out
 * Home in a second, anonymous context.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";
import { saveWords, shoot, THEME, uxDir, type Words } from "../support/ux";

const PAGES: Array<[string, string]> = [
  ["home", "/"],
  ["onboarding", "/onboarding"],
  ["remoras", "/remoras"],
  ["remoras-new", "/remoras/new"],
  ["funds", "/funds"],
  ["memory", "/memory"],
  ["memory-chat", "/memory?tab=chat"],
  ["approvals", "/approvals"],
  ["settings", "/settings"],
  ["verify", "/verify"],
  ["guide", "/guide"],
  ["chat", "/chat"],
  // ADR-0088: the pages added since U13.
  ["playground", "/playground"],
  ["hatchery", "/hatchery"],
  ["status", "/status"],
  ["reef", "/reef"],
  ["connect", "/connect/audit-preview"],
  ["not-found", "/this-page-does-not-exist"],
];

/** The app does not auto-connect, so after a navigation the session stays but the wallet must reconnect. */
// A full light and dark pass is hundreds of reads; each page counts as its own client so the local
// server's per-address limit (iplimit.ts, 200 an hour) never leaves a "too many requests" state in a
// picture (U13, ADR-0070).
const freshClient = () =>
  `10.14.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function goto(page: Page, path: string) {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await page.goto(path);
  const reconnect = page.getByRole("button", { name: "Reconnect" });
  await reconnect.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  if (await reconnect.isVisible().catch(() => false)) {
    await reconnect.click({ timeout: 30_000 });
    await page.getByRole("button", { name: WALLET_NAME }).click();
    await expect(reconnect).toBeHidden({ timeout: 30_000 });
  }
}

/** An existing remora id, read through the page's own session. */
async function findRemora(page: Page): Promise<string | null> {
  const body = await page
    .evaluate(async () => {
      const res = await fetch("/api/remoras", { headers: { "x-remora-network": "testnet" } });
      if (!res.ok) return null;
      return (await res.json()) as { remoras?: Array<{ id: string }> };
    })
    .catch(() => null);
  return body?.remoras?.[0]?.id ?? null;
}

/** The U14 review capture runs the same file under its own projects (`UX=1`, support/ux.ts). */
const isUx = (info: TestInfo) => info.project.name.startsWith("ux-");

test("signed-in audit: light and dark", async ({ page }, info) => {
  test.skip(isUx(info), "the audit pictures, not the U14 capture");
  test.setTimeout(10 * 60_000);
  const wallet = await installTestWallet(page, burner());

  await page.goto("/");
  await connectAndSignIn(page);
  // U14 (ADR-0103): the setup checklist's step says Sign in too (one name for one act), so every
  // Sign in button is gone once the session exists.
  await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);

  const pages = [...PAGES];
  const remora = await findRemora(page);
  if (remora) {
    pages.push(
      ["remora-overview", `/remoras/${remora}`],
      ["remora-activity", `/remoras/${remora}?tab=activity`],
      ["remora-settings", `/remoras/${remora}?tab=settings`],
    );
  }

  for (const [name, path] of pages) {
    await goto(page, path);
    await page.waitForTimeout(3500);
    await page.screenshot({
      path: `../docs/e2e/screenshots/audit-light-${name}.png`,
      fullPage: true,
    });
  }

  // Dark: the theme default follows the system, so emulating the system is enough.
  await page.emulateMedia({ colorScheme: "dark" });
  for (const [name, path] of pages) {
    await goto(page, path);
    await page.waitForTimeout(3500);
    await page.screenshot({
      path: `../docs/e2e/screenshots/audit-dark-${name}.png`,
      fullPage: true,
    });
  }

  void wallet;
});

test("signed-out audit: home", async ({ page }, info) => {
  test.skip(isUx(info), "the audit pictures, not the U14 capture");
  await page.goto("/");
  await expect(page.getByText(/Always-on agents you own/).first()).toBeVisible();
  await page.screenshot({
    path: "../docs/e2e/screenshots/audit-light-home-signed-out.png",
    fullPage: true,
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await page.screenshot({
    path: "../docs/e2e/screenshots/audit-dark-home-signed-out.png",
    fullPage: true,
  });
});

// ---- U14 (ADR-0103): the review capture. UX=1, read-only apart from one share link on the local DB.

/** Finds the first value of `key` anywhere in a JSON answer. */
function findKey(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  for (const [k, v] of Object.entries(value)) {
    if (k === key && typeof v === "string" && v) return v;
    const inner = findKey(v, key);
    if (inner) return inner;
  }
  return null;
}

async function apiJson(page: Page, path: string, method = "GET"): Promise<unknown> {
  return page
    .evaluate(
      async ([p, m]) => {
        const res = await fetch(p, { method: m, headers: { "x-remora-network": "testnet" } });
        return res.ok ? res.json() : null;
      },
      [path, method] as const,
    )
    .catch(() => null);
}

async function capture(
  page: Page,
  info: TestInfo,
  list: Array<[string, string]>,
  words: Record<string, Words>,
  settle = 3500,
) {
  for (const [name, path] of list) {
    await goto(page, path);
    await page.waitForTimeout(settle);
    await shoot(page, info, name, words);
  }
}

test.describe("U14 review capture", () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(!isUx(info), "UX=1 only");
    await page.emulateMedia({ colorScheme: THEME });
  });

  test("signed in with data (the burner)", async ({ page }, info) => {
    test.setTimeout(30 * 60_000);
    await installTestWallet(page, burner());
    await page.goto("/");
    await connectAndSignIn(page);
    // U14 (ADR-0103): the setup checklist's step says Sign in too (one name for one act), so every
    // Sign in button is gone once the session exists.
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);

    const list: Array<[string, string]> = [
      ...PAGES,
      ["connections", "/connections"],
      ["lab", "/lab"],
    ];
    const remoras = (await apiJson(page, "/api/remoras")) as {
      remoras?: Array<{ id: string; template?: string }>;
    } | null;
    const all = remoras?.remoras ?? [];
    const scout = all.find((r) => r.template === "scout") ?? all[0];
    const sentinel = all.find((r) => r.template === "sentinel");
    for (const [kind, r] of [
      ["researcher", scout],
      ["watcher", sentinel],
    ] as const) {
      if (!r) continue;
      for (const tab of ["overview", "activity", "learning", "settings"]) {
        list.push([`remora-${kind}-${tab}`, `/remoras/${r.id}?tab=${tab}`]);
      }
      list.push([`thread-${kind}`, `/chat/r/${r.id}`]);
    }
    if (scout) list.push(["share", `/remoras/${scout.id}/share`]);
    list.push(["remoras-import", "/remoras/import"]);
    const room = findKey(await apiJson(page, "/api/rooms"), "id");
    if (room) list.push(["room", `/chat/room/${room}`]);
    const template = findKey(await apiJson(page, "/api/hatchery"), "templateId");
    if (template) list.push(["hatchery-template", `/hatchery/${template}`]);
    // A feed item carries its Wake as `receiptId`; /verify/:ref takes it as is.
    const wake = findKey(await apiJson(page, "/api/feed?type=payment&limit=50"), "receiptId");
    if (wake) {
      list.push(["verify-receipt", `/verify/${wake}`]);
      const receipt = findKey(await apiJson(page, `/api/verify/${wake}`), "receiptId") ?? wake;
      const token = findKey(
        await apiJson(page, `/api/wakes/${encodeURIComponent(receipt)}/share`, "POST"),
        "token",
      );
      if (token) list.push(["public-receipt", `/p/${token}`]);
    }
    const pending = (await apiJson(page, "/api/approvals?status=pending")) as {
      approvals?: unknown[];
    } | null;
    console.log(
      `[ux] remoras=${all.length} room=${!!room} template=${!!template} wake=${!!wake} pending=${pending?.approvals?.length ?? 0}`,
    );

    const words: Record<string, Words> = {};
    await capture(page, info, list, words);
    saveWords(info, words);
  });

  test("signed in, empty (a fresh key)", async ({ page }, info) => {
    test.setTimeout(10 * 60_000);
    await installTestWallet(page, Ed25519Keypair.generate());
    await page.goto("/");
    await connectAndSignIn(page);
    const words: Record<string, Words> = {};
    await capture(
      page,
      info,
      [
        ["empty-home", "/"],
        ["empty-remoras", "/remoras"],
        ["empty-chat", "/chat"],
        ["empty-funds", "/funds"],
        ["empty-approvals", "/approvals"],
        ["empty-memory", "/memory"],
        ["empty-connections", "/connections"],
        ["empty-settings", "/settings"],
        ["empty-onboarding", "/onboarding"],
      ],
      words,
    );
    saveWords(info, words);
  });

  test("signed out", async ({ page }, info) => {
    test.setTimeout(10 * 60_000);
    const words: Record<string, Words> = {};
    await capture(
      page,
      info,
      [
        ["out-home", "/"],
        ["out-playground", "/playground"],
        ["out-remoras", "/remoras"],
        ["out-verify", "/verify"],
        ["out-guide", "/guide"],
        ["out-hatchery", "/hatchery"],
        ["out-status", "/status"],
        ["out-reef", "/reef"],
      ],
      words,
    );
    const signIn = page.getByRole("button", { name: "Sign in" }).first();
    if (await signIn.isVisible().catch(() => false)) {
      await signIn.click();
      await page.waitForTimeout(1200);
      await shoot(page, info, "out-sign-in", words);
    }
    saveWords(info, words);
  });

  test("loading and error", async ({ page }, info) => {
    test.setTimeout(15 * 60_000);
    await installTestWallet(page, burner());
    await page.goto("/");
    await connectAndSignIn(page);
    const scout = findKey(await apiJson(page, "/api/remoras"), "id");
    const list: Array<[string, string]> = [
      ["home", "/"],
      ["chat", "/chat"],
      ["funds", "/funds"],
      ["approvals", "/approvals"],
      ["memory", "/memory"],
      ...(scout ? ([["remora", `/remoras/${scout}`]] as Array<[string, string]>) : []),
    ];
    // The session and the config answer; the page's own data doesn't, or fails.
    const keep = /\/api\/(me|config|networks|auth)\b/;
    const words: Record<string, Words> = {};
    for (const mode of ["loading", "error"] as const) {
      await page.route("**/api/**", async (route) => {
        if (keep.test(route.request().url())) return route.continue();
        if (mode === "error") return route.fulfill({ status: 500, body: '{"error":"down"}' });
        await new Promise((r) => setTimeout(r, 20_000));
        return route.continue().catch(() => {});
      });
      for (const [name, path] of list) {
        await page.goto(path);
        await page.waitForTimeout(mode === "loading" ? 1500 : 3500);
        await shoot(page, info, `${mode}-${name}`, words);
      }
      await page.unrouteAll({ behavior: "ignoreErrors" });
    }
    saveWords(info, words);
  });

  test("landing page, by section", async ({ page }, info) => {
    test.setTimeout(5 * 60_000);
    const root = resolve(import.meta.dirname, "../..");
    execSync("bun apps/landing/build.ts", { cwd: root, stdio: "ignore" });
    await page.goto(pathToFileURL(`${root}/apps/landing/dist/index.html`).href);
    await page.waitForTimeout(2500);
    const words: Record<string, Words> = {};
    await shoot(page, info, "landing", words);
    const parts = page.locator("body > header, body > section, body > footer, main > section");
    const n = await parts.count();
    for (let i = 0; i < n; i++) {
      const part = parts.nth(i);
      await part.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      const id = (await part.getAttribute("id")) ?? `part-${i}`;
      await part.screenshot({
        path: `${uxDir(info)}/landing-${String(i).padStart(2, "0")}-${id}.jpg`,
        type: "jpeg",
        quality: 72,
      });
    }
    saveWords(info, words);
  });
});
