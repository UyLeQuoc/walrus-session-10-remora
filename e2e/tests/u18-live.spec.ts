/**
 * U18 D (ADR-0119): one answer bought on a deployment's public page. Opt in with
 * `U18_LIVE=1 E2E_BASE_URL=https://getremora.vercel.app bun run --filter @remora/e2e e2e -- --project=u18live`.
 * It spends the price (0.01 testnet USDC) from the second test owner, plus what the seller pays its
 * own sources.
 *
 * - The seller is the burner's `@uy-researcher` while its spending limit is still on Sui. Otherwise a
 *   new Researcher goes on sale as `U18_LIVE_SLUG` (default `ask-researcher`).
 * - burner2, signed out, opens `/r/<slug>`, connects its wallet and pays for one answer.
 * - The payment is read back from Sui: the seller's owner got the price.
 *
 * What happened goes to `exit-results/u18-live.json` (gitignored), for the exit note.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { expect, type Page, test } from "@playwright/test";
import { listOwnerDiscs } from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

mkdirSync("exit-results", { recursive: true });
const KEPT = "uy-researcher";
const SLUG = process.env.U18_LIVE_SLUG || "ask-researcher";

const api = <T>(page: Page, path: string, init: { method?: string; body?: unknown } = {}) =>
  page.evaluate(
    async ({ p, method, body }) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p, {
        method: method ?? "GET",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return res.json();
    },
    { p: path, method: init.method, body: init.body },
  ) as Promise<T>;

function burner2() {
  const raw = process.env.E2E_BURNER2_KEY;
  if (!raw) throw new Error("E2E_BURNER2_KEY is not set");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

type Row = { id: string; name: string; status: string; discId: string | null };

/** The burner's active remora selling as `slug`, if any. */
async function selling(page: Page, rows: Row[], slug: string) {
  for (const r of rows.filter((x) => x.status === "active")) {
    const v = await api<{ sale: { slug: string } | null }>(page, `/api/remoras/${r.id}/sell`);
    if (v.sale?.slug === slug) return r;
  }
  return undefined;
}

test("U18 live: a signed-out visitor buys one answer on the deployment's public page", async ({
  page,
  browser,
}) => {
  test.setTimeout(15 * 60_000);
  const result: Record<string, unknown> = { base: process.env.E2E_BASE_URL };
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const { remoras } = await api<{ remoras: Row[] }>(page, "/api/remoras");
  const d = DEPLOYMENTS.testnet;
  const onChain = new Set(
    (
      await listOwnerDiscs(
        testnet().core,
        { packageId: d.remoraPackageId, registryId: d.discRegistryId, coinType: d.usdcCoinType },
        burner().toSuiAddress(),
      )
    ).map((x) => x.disc.id),
  );
  const kept = await selling(page, remoras, KEPT);
  result.kept = kept
    ? { id: kept.id, discOnChain: !!kept.discId && onChain.has(kept.discId) }
    : null;
  let slug = KEPT;
  if (!kept?.discId || !onChain.has(kept.discId)) {
    // A new seller: a Researcher with a small limit, on sale at 0.01.
    slug = SLUG;
    const existing = await selling(page, remoras, SLUG);
    const fresh = existing?.discId && onChain.has(existing.discId) ? existing : undefined;
    let id = fresh?.id ?? "";
    if (!fresh) {
      await page.goto("/remoras/new");
      await page.getByRole("radio", { name: /^Researcher/ }).click();
      await page.getByRole("textbox", { name: "Name" }).fill("Researcher · ask me");
      await page.getByLabel("Monthly limit (USDC)").fill("0.3");
      await page.getByLabel("Most it pays at once (USDC)").fill("0.02");
      await page.getByRole("button", { name: /^Create / }).click();
      await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
      id = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
      await page.getByRole("button", { name: "Go live" }).click();
      await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
      await page.goto(`/remoras/${id}`);
      const sell = page.getByTestId("sell-card");
      await sell.getByLabel("Its name in the Reef").fill(SLUG);
      await sell.getByLabel("Price per answer, USDC").fill("0.01");
      await sell.getByLabel("One line about it").fill("Sui package checks, prices and repo health");
      await sell.getByRole("button", { name: "Sell its answers" }).click();
      await expect(page.getByTestId("sell-listed")).toContainText(`@${SLUG}`, { timeout: 30_000 });
    }
    result.seller = { id, slug, new: !fresh };
  } else result.seller = { id: kept.id, slug, new: false };

  // burner2, signed out, in its own browser.
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await installTestWallet(visitor, burner2());
  await visitor.goto(`/r/${slug}`);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  const question = "Is package 0x2 safe to depend on?";
  await visitor.getByLabel("Your question").fill(question);
  await visitor.getByTestId("public-pay").click();
  const answer = visitor.getByTestId("public-answer");
  await expect(answer).toBeVisible({ timeout: 300_000 });
  const digest = (await answer.getByTestId("public-verify").getAttribute("href"))?.split("/").pop();
  expect(digest).toBeTruthy();
  const tx = await testnet().core.getTransaction({
    digest: digest as string,
    include: { effects: true, balanceChanges: true },
  });
  const done = tx.Transaction ?? tx.FailedTransaction;
  expect(done?.effects?.status.success).toBe(true);
  const owner = normalizeSuiAddress(burner().toSuiAddress());
  expect(
    (done?.balanceChanges ?? []).some((b) => b.address === owner && BigInt(b.amount) === 10_000n),
    "the seller's owner got 0.01 USDC",
  ).toBe(true);
  Object.assign(result, {
    question,
    digest,
    buyer: burner2().toSuiAddress(),
    answer: (await answer.innerText()).slice(0, 400),
    at: new Date().toISOString(),
  });
  writeFileSync("exit-results/u18-live.json", JSON.stringify(result, null, 2));
  await ctx.close();
});
