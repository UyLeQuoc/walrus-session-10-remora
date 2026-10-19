/**
 * Smoke (desktop + mobile): every page paints signed out (W2 pages ask for a wallet session first),
 * the TESTNET badge shows, nothing scrolls sideways. The signed-in W2 flow is w2.spec.ts.
 */
import { expect, test } from "@playwright/test";

const PAGES: [string, RegExp][] = [
  ["/", /Always-on agents you own/],
  ["/chat", /Teach Sentinel/],
  ["/onboarding", /Sign in with your wallet/],
  ["/remoras", /Sign in with your wallet to see your remoras/],
  ["/remoras/new", /Sign in with your wallet to see the create wizard/],
  ["/memory", /Sign in with your wallet to see your remoras' memory/],
  ["/approvals", /Sign in with your wallet to see your approvals/],
  ["/settings", /Sign in with your wallet to see your settings/],
  ["/verify", /Check|Verify/],
  ["/funds", /Sign in with your wallet to see your funds/],
];

for (const [path, text] of PAGES) {
  test(`renders ${path}`, async ({ page }, info) => {
    await page.goto(path);
    // The mobile header repeats the page name, so a bare text match can land on a hidden title.
    const target =
      path === "/verify"
        ? page.getByRole("button", { name: "Verify" })
        : page.getByText(text).first();
    await expect(target).toBeVisible();
    if (path === "/chat") await expect(page.getByPlaceholder("Message your remora…")).toBeVisible();
    await expect(page.getByTestId("testnet-badge")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(1);
    const name = path === "/" ? "home" : path.slice(1).replaceAll("/", "-");
    await page.screenshot({ path: `screenshots/${info.project.name}-${name}.png`, fullPage: true });
  });
}

test("mainnet is offered but disabled until it's published", async ({ page }) => {
  await page.goto("/remoras");
  await page.getByTestId("testnet-badge").click();
  const mainnet = page.getByRole("menuitemradio", { name: /Mainnet/ });
  await expect(mainnet).toHaveAttribute("data-disabled", "");
  await expect(page.getByRole("menuitemradio", { name: /Testnet/ })).toHaveAttribute(
    "data-state",
    "checked",
  );
});

/**
 * Phase 6 §2: every page shares one left edge and one right gutter. The gated pages render a
 * sign-in state whose `h1` is used where the real page cannot paint signed out.
 */
const EDGE_ROUTES = [
  "/",
  "/remoras",
  "/approvals",
  "/funds",
  "/memory",
  "/settings",
  "/verify",
  "/remoras/new",
  "/remoras/00000000-0000-0000-0000-000000000000",
];

test("every page shares one left edge at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const measured: Array<{ path: string; h1x: number; rightGap: number }> = [];
  for (const path of EDGE_ROUTES) {
    await page.goto(path);
    const h1 = page.locator("h1").first();
    await expect(h1, `${path} has an h1`).toBeVisible();
    const box = await h1.boundingBox();
    const rightGap = await page.evaluate(() => {
      const column = document.querySelector('[data-slot="page-column"]');
      const shell = document.querySelector('[data-slot="sidebar-inset"]');
      if (!column || !shell) return null;
      return shell.getBoundingClientRect().right - column.getBoundingClientRect().right;
    });
    if (box === null || rightGap === null) throw new Error(`no geometry for ${path}`);
    measured.push({ path, h1x: box.x, rightGap });
  }
  const first = measured[0] as { h1x: number; rightGap: number };
  for (const row of measured) {
    expect(Math.abs(row.h1x - first.h1x), `${row.path} h1 x`).toBeLessThanOrEqual(1);
    expect(Math.abs(row.rightGap - first.rightGap), `${row.path} right gutter`).toBeLessThanOrEqual(
      1,
    );
  }
});
