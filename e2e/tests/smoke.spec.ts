/** Smoke (desktop + mobile): every W1 page paints, the TESTNET badge shows, nothing scrolls sideways. */
import { expect, test } from "@playwright/test";

const PAGES: [string, RegExp][] = [
  ["/", /Tell it once/],
  ["/onboarding", /Sign in with your wallet/],
  ["/remoras", /Scout/],
  ["/remoras/scout", /Paid 0\.05 USDC to reef:sui-risk/],
  ["/memory", /sui-risk: 9 calls, 8 useful/],
  ["/approvals", /Pay 2\.00 USDC to reef:odds/],
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

test("the Why drawer opens the Wake behind a payment", async ({ page }) => {
  await page.goto("/remoras/scout");
  await page.getByRole("button", { name: "Why?" }).first().click();
  await expect(page.getByText("sui-risk answered 8 of 9 risk questions usefully")).toBeVisible();
  await expect(page.getByText("anchored onchain")).toBeVisible();
});
