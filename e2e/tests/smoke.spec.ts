/**
 * Smoke (desktop + mobile): every page paints signed out (W2 pages ask for a wallet session first),
 * the TESTNET badge shows, nothing scrolls sideways. The signed-in W2 flow is w2.spec.ts.
 */
import { expect, test } from "@playwright/test";

/**
 * ADR-0100: on the deployed site, "/" shows the landing page to signed-out visitors, and the app's
 * home only once a session cookie exists. The local dev server always serves the app.
 */
const deployed = Boolean(process.env.E2E_BASE_URL);
const appOnly = (path: string) => !(deployed && path === "/");

const PAGES: [string, RegExp][] = [
  ["/", /Always-on agents you own/],
  ["/chat", /Teach Wallet watcher/],
  ["/onboarding", /Sign in with your wallet/],
  ["/remoras", /Sign in with your wallet to see your remoras/],
  ["/remoras/new", /Sign in with your wallet to see the create wizard/],
  ["/memory", /Sign in with your wallet to see your remoras' memory/],
  ["/approvals", /Sign in with your wallet to see your approvals/],
  ["/settings", /Sign in with your wallet to see your settings/],
  ["/verify", /Check|Verify/],
  ["/funds", /Sign in with your wallet to see your funds/],
  ["/remoras/import", /Sign in with your wallet to see team import/],
  ["/chat/r/0b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a10", /Sign in with your wallet to see this chat/],
  ["/chat/room/4f3e2d1c-0b9a-4876-8543-210fedcba987", /Sign in with your wallet to see this room/],
  // The Hatchery is public to browse (U7, ADR-0046); sharing needs a wallet.
  ["/hatchery", /Remoras people shared/],
  // U8 (ADR-0051, ADR-0052): try Scout without a wallet; the ops status board.
  ["/playground", /Try a Researcher/],
  ["/lab/health", /Every dependency Remora needs|Check again/],
  [
    "/remoras/0b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a10/share",
    /Sign in with your wallet to see sharing this remora/,
  ],
];

for (const [path, text] of PAGES.filter(([path]) => appOnly(path))) {
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
    const name =
      path === "/"
        ? "home"
        : path
            .slice(1)
            .replaceAll("/", "-")
            .replace(/-[0-9a-f-]{36}(-share)?$/, "$1");
    await page.screenshot({ path: `screenshots/${info.project.name}-${name}.png`, fullPage: true });
  });
}

test("the deployed / is the landing page signed out, and it links into the app", async ({
  page,
}) => {
  test.skip(!deployed, "only Vercel serves the landing page at /");
  for (const path of ["/", "/about"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toContainText("Always-on agents");
    await expect(page.locator('[data-link="playground"]').first()).toHaveAttribute(
      "href",
      /\/playground$/,
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(1);
  }
});

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
  for (const path of EDGE_ROUTES.filter(appOnly)) {
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
