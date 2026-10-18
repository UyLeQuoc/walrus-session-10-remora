/**
 * The testnet flow with the burner (never a real owner): sign in (A1), the session network and
 * header (A9), Detect funds + Withdraw + Move (A4), and the Discs + panic button (Disc panel, N10).
 */
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const money = async (page: Page, testId: string) =>
  Number(
    ((await page.getByTestId(testId).textContent()) ?? "").match(/\$([\d.]+)/)?.[1] ?? Number.NaN,
  );

test("burner: sign in, detect, withdraw, move, pause all, resume", async ({ page }) => {
  const kp = burner();
  const wallet = await installTestWallet(page, kp);

  // A9: every API call says testnet.
  const fundsCall = page.waitForRequest((r) => r.url().includes("/api/funds"));
  await page.goto("/funds");
  await expect(page.getByTestId("testnet-badge")).toBeVisible();

  // A1: connect the injected wallet and sign in through the app's own picker.
  await connectAndSignIn(page);
  expect((await fundsCall).headers()["x-remora-network"]).toBe("testnet");
  await expect(page.getByText("Your USDC on testnet")).toBeVisible();
  await expect(page.getByTestId("ready")).toContainText("$");
  await expect.poll(() => money(page, "ready")).not.toBeNaN();

  // A4: make sure there's a coin to move (withdraw 0.10 from the address balance), then move it all.
  if ((await money(page, "coins")) === 0) {
    await page.getByRole("button", { name: /Advanced/ }).click();
    await page.getByLabel("Withdraw amount (USDC)").fill("0.10");
    await page.getByRole("button", { name: "Withdraw to coin" }).click();
    await expect(page.getByText("Withdrawn to a coin.")).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => money(page, "coins"), { timeout: 60_000 }).toBeGreaterThan(0);
  }
  const readyBefore = await money(page, "ready");
  const coinsBefore = await money(page, "coins");
  await page.getByRole("button", { name: /Move \$[\d.]+ to address balance/ }).click();
  await expect(page.getByText("Moved to your address balance.")).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => money(page, "coins"), { timeout: 60_000 }).toBe(0);
  expect(await money(page, "ready")).toBeCloseTo(readyBefore + coinsBefore, 2);

  // Disc panel: at least one Disc (global setup issues one); pause them all from the header (N10).
  const rows = page.getByTestId("disc-row");
  await expect(rows.first()).toBeVisible({ timeout: 60_000 });
  for (const resume of await page.getByRole("button", { name: "Resume" }).all()) {
    await resume.click(); // a previous failed run may have left some paused
    await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0, { timeout: 90_000 });
  }
  await page.getByRole("button", { name: "Pause all spending" }).click();
  await expect(page.getByText(/Paused \d+ Disc/)).toBeVisible({ timeout: 90_000 });
  await expect(rows.filter({ hasText: "paused" })).toHaveCount(await rows.count(), {
    timeout: 60_000,
  });
  await page.screenshot({ path: "screenshots/testnet-funds-paused.png", fullPage: true });

  // Resume each Disc.
  while ((await page.getByRole("button", { name: "Resume" }).count()) > 0) {
    const before = await page.getByRole("button", { name: "Resume" }).count();
    await page.getByRole("button", { name: "Resume" }).first().click();
    await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(before - 1, {
      timeout: 90_000,
    });
  }
  await expect(rows.filter({ hasText: "live" })).toHaveCount(await rows.count());
  await page.screenshot({ path: "screenshots/testnet-funds-live.png", fullPage: true });
  expect(wallet.signed.length).toBeGreaterThanOrEqual(3);
});
