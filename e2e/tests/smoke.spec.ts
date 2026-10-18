/**
 * Smoke (desktop + mobile): every page paints signed out (W2 pages ask for a wallet session first),
 * the TESTNET badge shows, nothing scrolls sideways. The signed-in W2 flow is w2.spec.ts.
 */
import { expect, test } from "@playwright/test";

const PAGES: [string, RegExp][] = [
  ["/", /Tell it once/],
  ["/onboarding", /Sign in with your wallet/],
  ["/remoras", /Sign in with your wallet to see your remoras/],
  ["/remoras/new", /Sign in with your wallet to see the create wizard/],
  ["/memory", /Sign in with your wallet to see your remoras' memory/],
  ["/approvals", /Sign in with your wallet to see your approvals/],
  ["/settings", /Sign in with your wallet to see your settings/],
  ["/verify", /Check|Verify/],
  ["/funds", /Connect your wallet to see your funds/],
];

for (const [path, text] of PAGES) {
  test(`renders ${path}`, async ({ page }, info) => {
    await page.goto(path);
    await expect(page.getByText(text).first()).toBeVisible();
    if (path === "/") await expect(page.getByPlaceholder("Message your remora…")).toBeVisible();
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
  const mainnet = page.getByRole("radio", { name: "mainnet" });
  await expect(mainnet).toBeDisabled();
  await expect(page.getByRole("radio", { name: "testnet" })).toHaveAttribute("data-state", "on");
});
