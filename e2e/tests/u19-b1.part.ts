/**
 * U19 B1 (ADR-0145), for the lead to paste into `u19.spec.ts` (this file is not a spec; no project
 * matches it). The exit, on testnet against the local stack:
 * 1. the burner shares its Researcher's Wakes with burner2 (one signature);
 * 2. burner2's `/audit/<capsuleId>` page, with no account, decrypts them and matches every receipt;
 * 3. the burner revokes (digest);
 * 4. a reload can't decrypt, and says why.
 *
 * In `u19.spec.ts`:
 *   test("B1: an auditor reads the Researcher's Wakes, then the burner revokes", async ({ page, browser }) => {
 *     test.setTimeout(10 * 60_000);
 *     await b1(page, browser, { signedIn, rotate, api, key, save, prior, byName, freshClient });
 *   });
 */

import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { type Browser, expect, type Page } from "@playwright/test";
import { installTestWallet, WALLET_NAME } from "../support/test-wallet";

export interface B1Helpers {
  signedIn: (page: Page) => Promise<void>;
  rotate: (page: Page) => Promise<void>;
  api: <T>(page: Page, path: string, init?: { method?: string; body?: unknown }) => Promise<T>;
  key: (name: "E2E_BURNER2_KEY" | "E2E_BURNER3_KEY") => Ed25519Keypair;
  save: (patch: Record<string, unknown>) => void;
  prior: () => Record<string, unknown>;
  byName: (page: Page, name: string) => Promise<string>;
  freshClient: () => string;
}

type Share = { capsuleId: string; digest: string; revoked: string | null; count: number };

export async function b1(page: Page, browser: Browser, h: B1Helpers) {
  await h.signedIn(page);
  const id =
    (h.prior() as { researcher?: string }).researcher || (await h.byName(page, "Researcher · u19"));
  expect(id, "A0–A2 made the Researcher").toBeTruthy();
  const auditor = h.key("E2E_BURNER2_KEY");

  // 1. Share the last week of Wakes with burner2, question text left out.
  await h.rotate(page);
  await page.goto(`/remoras/${id}?tab=activity`);
  const card = page.getByTestId("audit-card");
  await card.scrollIntoViewIfNeeded();
  await card.getByLabel("Auditor's address or .sui name").fill(auditor.toSuiAddress());
  await card.getByLabel("For how many days (1–30)").fill("7");
  await expect(card.getByTestId("audit-questions")).toHaveAttribute("data-state", "unchecked");
  await card.getByTestId("audit-share-button").click();
  const made = card.getByTestId("audit-made");
  await expect(made).toBeVisible({ timeout: 180_000 });
  const path = (await made.getByRole("link").getAttribute("href")) ?? "";
  const capsuleId = /\/audit\/(0x[0-9a-f]{64})$/.exec(path)?.[1] ?? "";
  expect(capsuleId, path).toBeTruthy();

  // 2. burner2 opens it with no account: connect, sign a session key, every receipt matches Sui.
  const visitor = await (await browser.newContext()).newPage();
  await installTestWallet(visitor, auditor);
  await visitor.context().setExtraHTTPHeaders({ "x-forwarded-for": h.freshClient() });
  await visitor.goto(path);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  await visitor.getByTestId("audit-open").click();
  const match = visitor.getByTestId("audit-match");
  await expect(match).toHaveText(/^(\d+) of \1 receipts? match(es)? Sui$/, { timeout: 180_000 });
  const matched = (await match.textContent()) ?? "";
  const wakes = await visitor.getByTestId("audit-wake").count();
  // The question text was left out: no "Question:" line anywhere.
  await expect(visitor.getByText("Question:")).toHaveCount(0);

  // 3. The burner revokes with one signature.
  await h.rotate(page);
  const row = card.getByTestId("audit-share").filter({ hasText: capsuleId });
  await row.getByTestId("audit-revoke").click();
  await expect(row.getByText("taken back")).toBeVisible({ timeout: 180_000 });
  const { shares } = await h.api<{ shares: Share[] }>(page, `/api/remoras/${id}/audits`);
  const share = shares.find((s) => s.capsuleId === capsuleId);
  expect(share?.revoked, "the revoke's digest").toBeTruthy();

  // 4. A reload can't decrypt: the key servers refuse, and the page says so.
  await visitor.reload();
  const open = visitor.getByTestId("audit-open");
  if (!(await open.isVisible().catch(() => false))) {
    await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
    await visitor.getByRole("button", { name: WALLET_NAME }).click();
  }
  await visitor.getByTestId("audit-open").click();
  const said = visitor.getByTestId("audit-refused");
  await expect(said).toContainText("Access was revoked or expired: the key servers refused.", {
    timeout: 120_000,
  });
  const refused = (await said.textContent()) ?? "";
  await expect(visitor.getByTestId("audit-match")).toHaveCount(0);

  h.save({
    b1: {
      capsuleId,
      path,
      createDigest: share?.digest,
      revokeDigest: share?.revoked,
      count: share?.count,
      wakes,
      matched,
      refused,
    },
  });
}
