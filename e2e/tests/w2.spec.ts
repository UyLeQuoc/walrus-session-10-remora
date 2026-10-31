/**
 * The W2 exit on testnet (U5 Phase C), with the burner as the owner (never a real owner):
 * 1. sign in → first remora (Scout with a Disc) in under 3 minutes;
 * 2. Scout buys `sui-risk` and answers; the payment's Wake verifies against the chain (G3);
 * 3. an over-limit purchase waits in the inbox and the owner pays it once (E4);
 * 4. Sentinel learns "ignore incoming SUI under 0.01" in plain words and applies it to real transfers;
 * 5. the Scout is retired (B8): the owner signs the revoke.
 * Timings and digests go to `test-results/w2-exit.json` for docs/spikes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { expect, type Page, test } from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

interface FeedEvent {
  id: string;
  type: string;
  summary: string;
  payload: Record<string, unknown>;
  receiptId: string | null;
}

const results: Record<string, unknown> = {};
const ms = (from: number) => Date.now() - from;

/** Same-origin API reads with the page's own session. */
const api = <T>(page: Page, path: string): Promise<T> =>
  page.evaluate(async (p) => {
    const session = localStorage.getItem("remora.session");
    const res = await fetch(p, {
      credentials: "include",
      headers: {
        "x-remora-network": "testnet",
        ...(session ? { "x-remora-session": session } : {}),
      },
    });
    return res.json();
  }, path) as Promise<T>;

const feedOf = async (page: Page, remoraId: string) => {
  const body = await api<{ events?: FeedEvent[] }>(page, `/api/feed?remora=${remoraId}`);
  if (!body.events) throw new Error(`feed: ${JSON.stringify(body)}`);
  return body.events;
};

/** Sends `mist` SUI from the burner to `to` and waits for it to be final. */
async function sendSui(to: string, mist: bigint): Promise<string> {
  const kp = burner();
  const client = testnet();
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [mist]);
  tx.transferObjects([coin as never], to);
  const r = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: kp,
    include: { effects: true },
  });
  const done = r.Transaction ?? r.FailedTransaction;
  if (!done.effects?.status.success) throw new Error(`transfer failed: ${done.digest}`);
  await client.core.waitForTransaction({ digest: done.digest });
  return done.digest;
}

/** The app resumes the last approved wallet silently; this is the fallback if that fails. */
async function goto(page: Page, path: string) {
  await page.goto(path);
  const reconnect = page.getByRole("button", { name: "Reconnect" });
  await reconnect.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
  if (await reconnect.isVisible().catch(() => false)) {
    await reconnect.click({ timeout: 30_000 });
    await page.getByRole("button", { name: WALLET_NAME }).click();
  }
  await expect(reconnect).toBeHidden({ timeout: 30_000 });
}

async function createRemora(
  page: Page,
  template: "Scout" | "Sentinel",
  fill: (p: Page) => Promise<void>,
) {
  await goto(page, "/remoras/new");
  await page.getByRole("radio", { name: new RegExp(`^${template}`) }).click();
  await fill(page);
  await page.getByRole("button", { name: `Create ${template}` }).click();
  await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
  return /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
}

test("W2 exit: first remora < 3 min, Scout pays and answers, E4 approval, Sentinel learns", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  const kp = burner();
  const wallet = await installTestWallet(page, kp);
  results.owner = kp.toSuiAddress();

  // 1. Sign in → first remora.
  const t0 = Date.now();
  await page.goto("/remoras/new");
  await connectAndSignIn(page);
  await expect(page.getByRole("radio", { name: /^Scout/ })).toBeVisible({ timeout: 60_000 });
  const stamp = Date.now().toString(36);
  const scoutId = await createRemora(page, "Scout", async (p) => {
    await p.getByLabel("Name").fill(`Scout ${stamp}`);
    await p.getByLabel("Monthly limit (USDC)").fill("0.5");
    // 0.015 a payment: sui-risk (0.01) passes, odds (0.02) has to ask the owner (E4).
    await p.getByLabel("Most it pays at once (USDC)").fill("0.015");
  });
  await expect(page.getByRole("heading", { name: `Scout ${stamp}`, exact: true })).toBeVisible();
  results.firstRemoraMs = ms(t0);
  expect(results.firstRemoraMs as number, "sign-in to first remora under 3 minutes").toBeLessThan(
    180_000,
  );
  results.scoutId = scoutId;
  await page.screenshot({ path: "screenshots/w2-scout-created.png", fullPage: true });

  // Out of shadow mode, so it really pays.
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });

  // 2. Scout buys sui-risk and answers with a Wake.
  const t1 = Date.now();
  await page.getByLabel("Question", { exact: true }).fill("Is package 0x2 safe to depend on?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 180_000 });
  results.askMs = ms(t1);
  results.answer = (await page.getByTestId("answer").textContent())?.slice(0, 400);
  const paid = (await feedOf(page, scoutId)).find(
    (e) => e.type === "payment" && e.payload.payee === "reef:sui-risk",
  );
  expect(paid, "Scout paid sui-risk").toBeTruthy();
  const payDigest = String(paid?.payload.digest ?? "");
  results.scoutPayment = payDigest;
  await page.getByRole("button", { name: "Why?" }).first().click();
  await expect(page.getByText(/saved onchain/).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.screenshot({ path: "screenshots/w2-why.png", fullPage: true });
  await page.keyboard.press("Escape");

  // The Wake checks out against the chain once the anchor job has seen Paid.intent.
  const t2 = Date.now();
  await expect
    .poll(
      async () => {
        const v = await api<{ checks?: { ok: boolean | null }[]; anchored?: boolean }>(
          page,
          `/api/verify/${payDigest}`,
        );
        return Boolean(v.anchored && v.checks?.every((c) => c.ok !== false));
      },
      { timeout: 180_000, intervals: [3_000] },
    )
    .toBe(true);
  results.anchorMs = ms(t2);
  await page.goto(`/verify/${payDigest}`);
  await expect(page.getByTestId("verify-verdict")).toContainText("verified");
  await page.screenshot({ path: "screenshots/w2-verify.png", fullPage: true });

  // 3. Over the per-payment cap: Scout asks; the owner pays once from the inbox (E4).
  await goto(page, `/remoras/${scoutId}`);
  await page.getByLabel("Question", { exact: true }).fill("What are the odds for tonight's match?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 180_000 });
  const t3 = Date.now();
  await goto(page, "/approvals");
  await page
    .getByTestId("approval")
    .filter({ hasText: `Scout ${stamp}` })
    .getByRole("button", { name: /Pay once \(0\.02 USDC\)/ })
    .click();
  await expect(page.getByTestId("approval-answer")).toBeVisible({ timeout: 180_000 });
  results.approvalMs = ms(t3);
  const approved = (await feedOf(page, scoutId)).find(
    (e) => e.type === "payment" && e.payload.approvedBy === "owner",
  );
  results.ownerPayment = approved?.payload.digest ?? null;
  expect(results.ownerPayment, "the owner's one-off payment settled").toBeTruthy();
  await page.screenshot({ path: "screenshots/w2-approval.png", fullPage: true });

  // 4. Sentinel watches a fresh address, learns a rule in plain words, and applies it.
  const watched = new Ed25519Keypair().toSuiAddress();
  results.watched = watched;
  const sentinelId = await createRemora(page, "Sentinel", async (p) => {
    await p.getByLabel("Name").fill(`Sentinel ${stamp}`);
    await p.getByLabel("Addresses to watch").fill(watched);
  });
  results.sentinelId = sentinelId;
  await page.getByLabel("Rule", { exact: true }).fill("Ignore incoming SUI under 0.01");
  await page.getByRole("button", { name: "Teach" }).click();
  await expect(page.getByRole("list", { name: "Rules" })).toContainText(
    "Ignore incoming SUI under 0.01",
  );
  // The watcher re-reads what to watch every 30 s; give it one round before sending.
  await page.waitForTimeout(35_000);
  const t4 = Date.now();
  results.smallTransfer = await sendSui(watched, 1_000_000n); // 0.001 SUI → ignored
  await expect
    .poll(async () => (await feedOf(page, sentinelId)).some((e) => e.type === "episode"), {
      timeout: 180_000,
      intervals: [3_000],
    })
    .toBe(true);
  results.ignoreMs = ms(t4);
  const t5 = Date.now();
  results.bigTransfer = await sendSui(watched, 20_000_000n); // 0.02 SUI → ping
  await expect
    .poll(async () => (await feedOf(page, sentinelId)).some((e) => e.type === "ping"), {
      timeout: 180_000,
      intervals: [3_000],
    })
    .toBe(true);
  results.pingMs = ms(t5);
  await page.reload();
  await page.screenshot({ path: "screenshots/w2-sentinel.png", fullPage: true });

  // B8: retire the Scout (the owner signs the revoke), so runs don't pile up Discs on the burner.
  await goto(page, `/remoras/${scoutId}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
  const retired = (await feedOf(page, scoutId)).find((e) => /retired/.test(e.summary));
  results.retire = retired?.payload.digest ?? null;

  results.signatures = wallet.signed.length;
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/w2-exit.json", JSON.stringify(results, null, 2));
  console.log("[w2-exit]", JSON.stringify(results));
});
