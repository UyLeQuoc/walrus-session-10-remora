/**
 * U17 E (ADR-0111): fills a deployment's template gallery. The curated templates are already on
 * Walrus and onchain (published by the E2E burner with `SEED=1`); a server records a template when
 * its author confirms the publish digest to it. This signs in as the burner and confirms each digest
 * in `e2e/seed/published.json`. It's testnet only, and confirms nothing that's already listed.
 *
 *   GALLERY=1 E2E_BASE_URL=https://getremora.vercel.app bun run --filter @remora/e2e e2e -- --project=gallery
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const PUBLISHED = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../seed/published.json"), "utf8"),
) as { name: string; digest: string }[];

const call = <T>(page: Page, path: string, method = "GET", body?: unknown) =>
  page.evaluate(
    async ([p, m, b]) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p as string, {
        method: m as string,
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
        },
        ...(b ? { body: JSON.stringify(b) } : {}),
      });
      return { status: res.status, body: (await res.json().catch(() => null)) as T };
    },
    [path, method, body] as const,
  );

test("gallery: the curated templates are confirmed to this deployment by their author", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const listed = async () =>
    new Set(
      (
        (await call<{ templates: { name: string }[] }>(page, "/api/hatchery")).body?.templates ?? []
      ).map((t) => t.name),
    );
  const before = await listed();
  for (const t of PUBLISHED) {
    if (before.has(t.name)) continue;
    const res = await call(page, "/api/hatchery/publish/confirm", "POST", { digest: t.digest });
    expect(res.status, `${t.name}: ${JSON.stringify(res.body)}`).toBe(200);
    await page.waitForTimeout(2_500);
  }
  const after = await listed();
  for (const t of PUBLISHED) expect(after.has(t.name), t.name).toBe(true);
});
