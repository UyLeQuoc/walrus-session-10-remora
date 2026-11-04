/**
 * Seeds the template gallery (ADR-0105). Opt in with
 * `SEED=1 bun run --filter @remora/e2e e2e -- --project=seed`.
 *
 * - **Publish:** `e2e/seed/templates/*.md` are published to Walrus and `remora_hatchery` through the
 *   real Hatchery (the safety review, then one publish transaction), signed by the E2E burner on
 *   testnet. A name the burner already has in the gallery is skipped, so a second run publishes
 *   nothing new.
 * - **Deprecate:** the burner's own test templates (`u7.spec`'s `Checker …`, `Watcher …`,
 *   `U7 desk …`) are deprecated onchain by their author, through the real deprecate transaction.
 *   The gallery hides deprecated templates (ADR-0105).
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Transaction } from "@mysten/sui/transactions";
import { expect, type Page, test } from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const TEMPLATES = resolve(import.meta.dirname, "../seed/templates");
/** What `u7.spec` names its templates: a word and a base-36 timestamp. */
const TEST_RUN = /^(Checker|Watcher|U7 desk|Helper) [0-9a-z]{6,10}$/;

type Listing = {
  templateId: string;
  name: string;
  author: string;
  safety: string;
  deprecated: boolean;
};

/** Same-origin API calls with the page's own session (as `u7.spec` does). */
const call = <T>(page: Page, path: string, method = "GET", body?: unknown) =>
  page.evaluate(
    async ([p, m, b]) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p as string, {
        method: m as string,
        credentials: "include",
        headers: {
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
          ...(b ? { "content-type": "application/json" } : {}),
        },
        ...(b ? { body: b as string } : {}),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, body: json, text };
    },
    [path, method, body === undefined ? "" : JSON.stringify(body)],
  ) as Promise<{ status: number; body: T; text: string }>;

/** `call`, waiting out the server's per-address limit (30 a minute) instead of failing on it. */
async function paced<T>(page: Page, path: string, method = "GET", body?: unknown) {
  for (;;) {
    const r = await call<T>(page, path, method, body);
    if (r.status !== 429) return r;
    await page.waitForTimeout(61_000);
  }
}

/** Signs and runs a transaction the server built, as the burner; returns its digest. */
async function sign(json: string): Promise<string> {
  const r = await testnet().signAndExecuteTransaction({
    transaction: Transaction.from(json),
    signer: burner(),
    include: { effects: true },
  });
  const done = r.Transaction ?? r.FailedTransaction;
  await testnet().core.waitForTransaction({ digest: done.digest });
  if (!r.Transaction) throw new Error(`transaction ${done.digest} failed`);
  return done.digest;
}

test("seed: a curated gallery, published to Walrus; the test runs' templates deprecated", async ({
  page,
}) => {
  test.setTimeout(30 * 60_000);
  const author = burner().toSuiAddress();
  await installTestWallet(page, burner());
  await page.goto("/hatchery");
  await connectAndSignIn(page);
  const gallery = async () =>
    (await paced<{ templates: Listing[] }>(page, "/api/hatchery")).body.templates ?? [];

  // 1. Publish the curated set, skipping a name the burner already published.
  const mine = new Set(
    (await gallery()).filter((t) => t.author === author && !t.deprecated).map((t) => t.name),
  );
  const published: string[] = [];
  for (const file of readdirSync(TEMPLATES)
    .filter((f) => f.endsWith(".md"))
    .sort()) {
    const markdown = readFileSync(resolve(TEMPLATES, file), "utf8");
    const name = /^name: (.+)$/m.exec(markdown)?.[1]?.trim() ?? file;
    if (mine.has(name)) {
      console.log(`seed: ${name} is already published`);
      continue;
    }
    const tx = await call<{ transaction: string; safety: { verdict: string } }>(
      page,
      "/api/hatchery/publish",
      "POST",
      { markdown },
    );
    expect(tx.status, `${name}: ${tx.text}`).toBe(200);
    const digest = await sign(tx.body.transaction);
    const done = await call<{ listing: Listing }>(page, "/api/hatchery/publish/confirm", "POST", {
      digest,
    });
    expect(done.status, `${name}: ${done.text}`).toBe(200);
    console.log(`seed: published ${name} (${tx.body.safety.verdict}) in ${digest}`);
    published.push(name);
  }

  // 2. Deprecate the burner's test-run templates, a page of the gallery at a time.
  let deprecated = 0;
  for (;;) {
    const stale = (await gallery()).filter(
      (t) => t.author === author && !t.deprecated && t.safety !== "block" && TEST_RUN.test(t.name),
    );
    if (!stale.length) break;
    for (const t of stale) {
      const tx = await paced<{ transaction: string }>(
        page,
        `/api/hatchery/${t.templateId}/deprecate`,
        "POST",
      );
      expect(tx.status, `${t.name}: ${tx.text}`).toBe(200);
      const digest = await sign(tx.body.transaction);
      const done = await paced(page, `/api/hatchery/${t.templateId}/deprecate/confirm`, "POST", {
        digest,
      });
      expect(done.status, `${t.name}: ${done.text}`).toBe(200);
      deprecated++;
    }
  }
  console.log(`seed: published ${published.length}, deprecated ${deprecated}`);

  // 3. The gallery shows the curated set, reviewed, and none of the test runs.
  const shown = (await gallery()).filter((t) => !t.deprecated && t.safety !== "block");
  for (const file of readdirSync(TEMPLATES).filter((f) => f.endsWith(".md"))) {
    const name = /^name: (.+)$/m.exec(readFileSync(resolve(TEMPLATES, file), "utf8"))?.[1]?.trim();
    expect(shown.map((t) => t.name)).toContain(name);
  }
  expect(shown.filter((t) => t.author === author && TEST_RUN.test(t.name))).toEqual([]);
});
