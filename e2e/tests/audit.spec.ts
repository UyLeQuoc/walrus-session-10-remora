/**
 * The signed-in audit pass (plan §7.3, follow-up item 11): every page in light and dark, written to
 * `docs/e2e/screenshots/audit-{light,dark}-<page>.png`. Opt in with `AUDIT=1` so the default run
 * does not spend the burner. It only signs in and reads; no payment is made.
 *
 * Besides the static pages it captures a remora's Overview / Activity / Settings tabs (an id read
 * from the API this test is already signed in to), `/connect`, the 404 page, and the signed-out
 * Home in a second, anonymous context.
 */
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

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
  ["connect", "/connect/audit-preview"],
  ["not-found", "/this-page-does-not-exist"],
];

/** The app does not auto-connect, so after a navigation the session stays but the wallet must reconnect. */
async function goto(page: Page, path: string) {
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

test("signed-in audit: light and dark", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const wallet = await installTestWallet(page, burner());

  await page.goto("/");
  await connectAndSignIn(page);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeHidden();

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

test("signed-out audit: home", async ({ page }) => {
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
