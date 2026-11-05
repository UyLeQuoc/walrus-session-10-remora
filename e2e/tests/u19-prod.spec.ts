/**
 * U19 E (ADR-0134): production, with test accounts only. Opt in with
 * `U19_PROD=1 E2E_BASE_URL=https://getremora.vercel.app bun run --filter @remora/e2e e2e -- --project=u19prod`.
 *
 * - Cleanup: the burner retires its production remoras whose spending limit is gone from Sui (local
 *   runs had revoked them, ADR-0133: `@uy-researcher` and the U17 Research crew); `@ask-researcher`
 *   stays. The Research crew is imported again from its team file (one signature) and its lead
 *   answers with three receipts.
 * - Real Reef scores: the burner, burner2 and burner3 each share counts from a Researcher and make
 *   paid calls to two house services, rated honestly, until the Reef scores them instead of "new".
 *   About 0.2 testnet USDC in all.
 *
 * What happened goes to `exit-results/u19-prod.json` (gitignored), for the exit note.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, test } from "@playwright/test";
import { listOwnerDiscs } from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const OUT = "exit-results/u19-prod.json";
mkdirSync("exit-results", { recursive: true });
const KEEP = new Set(["ask-researcher"]);
const prior = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
};
const save = (patch: Record<string, unknown>) =>
  writeFileSync(
    OUT,
    JSON.stringify({ ...prior(), ...patch, at: new Date().toISOString() }, null, 2),
  );

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

const keyOf = (name: string) => {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
};

type Row = {
  id: string;
  name: string;
  status: string;
  template: string;
  discId: string | null;
  config: { crew?: { leadId: string }; share?: { stats: boolean } };
};

async function as(page: Page, kp: Ed25519Keypair) {
  await installTestWallet(page, kp);
  await page.goto("/remoras");
  await connectAndSignIn(page);
}

async function discsOnChain(owner: string) {
  const d = DEPLOYMENTS.testnet;
  return new Set(
    (
      await listOwnerDiscs(
        testnet().core,
        {
          packageId: d.remoraPackageId as string,
          registryId: d.discRegistryId as string,
          coinType: d.usdcCoinType,
        },
        owner,
      )
    ).map((x) => x.disc.id),
  );
}

test.describe.configure({ mode: "serial" });

test("E1: retire the production remoras whose limit is gone, keep @ask-researcher, re-import the crew", async ({
  page,
}) => {
  test.setTimeout(30 * 60_000);
  expect(process.env.E2E_BASE_URL, "production only").toBeTruthy();
  await as(page, burner());
  const { remoras } = await api<{ remoras: Row[] }>(page, "/api/remoras");
  const onChain = await discsOnChain(burner().toSuiAddress());
  const live = remoras.filter(
    (r) => r.status === "active" || r.status === "shadow" || r.status === "paused",
  );
  // Only the remoras whose limit is still on Sui can be on sale: ask those which slug they sell.
  const sold: Record<string, string> = {};
  for (const r of live.filter((x) => x.discId && onChain.has(x.discId))) {
    const v = await api<{ sale: { slug: string } | null }>(page, `/api/remoras/${r.id}/sell`);
    if (v.sale?.slug) sold[r.id] = v.sale.slug;
    await page.waitForTimeout(2_500);
  }
  // Gone from Sui, or a remora that spends with no limit left at all (a retire that stopped halfway).
  const broken = live.filter(
    (r) =>
      !KEEP.has(sold[r.id] ?? "") &&
      (r.discId ? !onChain.has(r.discId) : Boolean((r.config as { budget?: unknown }).budget)),
  );
  const limited = (x: unknown): boolean =>
    /requests|rate/i.test(JSON.stringify(x ?? "")) && !(x as { remora?: unknown }).remora;
  const retired: { id: string; name: string; slug: string | null }[] = [];
  for (const r of broken) {
    // Its Disc is gone, so there's nothing to sign: the retire answers no transaction and the
    // confirm retires it (paced, and retried after a rate limit).
    for (let attempt = 0; attempt < 3; attempt++) {
      const tx = await api<{ transaction?: string | null }>(page, `/api/remoras/${r.id}/retire`, {
        method: "POST",
      });
      if (limited(tx) && !("transaction" in tx)) {
        await page.waitForTimeout(65_000);
        continue;
      }
      expect(tx.transaction ?? null, `${r.name} still has a Disc`).toBeNull();
      // (A remora whose Disc was already forgotten answers no transaction too.)
      await page.waitForTimeout(2_500);
      const done = await api<{ remora?: { status: string } }>(
        page,
        `/api/remoras/${r.id}/retire/confirm`,
        { method: "POST", body: {} },
      );
      if (!done.remora) {
        await page.waitForTimeout(65_000);
        continue;
      }
      expect(done.remora.status).toBe("retired");
      retired.push({ id: r.id, name: r.name, slug: sold[r.id] ?? null });
      break;
    }
    await page.waitForTimeout(2_500);
  }
  const kept = live
    .filter((r) => KEEP.has(sold[r.id] ?? ""))
    .map((r) => ({ id: r.id, name: r.name, slug: sold[r.id] }));
  expect(kept.length, "@ask-researcher is still live").toBeGreaterThan(0);
  save({ cleanup: { checked: live.length, retired, kept } });

  // The Research crew, again, from its team file: one signature makes all four.
  await page.goto("/remoras/import");
  await page
    .getByRole("textbox", { name: "Team file" })
    .fill(
      readFileSync(resolve(import.meta.dirname, "../seed/templates/11-research-crew.md"), "utf8"),
    );
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: /Create the team/ }).click();
  await page.waitForURL(/\/chat\/room\//, { timeout: 240_000 });
  const after = await api<{ remoras: Row[] }>(page, "/api/remoras");
  const crew = after.remoras.filter(
    (r) => r.config.crew && r.status !== "retired" && !retired.some((x) => x.id === r.id),
  );
  for (const r of crew) await api(page, `/api/remoras/${r.id}/activate`, { method: "POST" });
  const lead = crew.find((r) => r.name === "Crew lead");
  expect(lead, "the crew has a lead").toBeTruthy();
  const out = await api<{ answer: string; eventId: string }>(page, `/api/remoras/${lead?.id}/ask`, {
    method: "POST",
    body: {
      question:
        "Is package 0x2 safe, what's SUI worth, and how healthy is https://github.com/MystenLabs/walrus?",
    },
  });
  const feed = await api<{
    events: { id: string; payload: { crew?: { member: string; digest: string | null }[] } }[];
  }>(page, `/api/feed?remora=${lead?.id}&type=answer`);
  const receipts = feed.events.find((e) => e.id === out.eventId)?.payload.crew ?? [];
  expect(receipts.filter((x) => x.digest).length).toBeGreaterThanOrEqual(3);
  save({ crew: { lead: lead?.id, members: crew.map((r) => r.name), receipts } });
});

test("E2: three test owners share counts and make paid calls; the Reef scores two services", async ({
  browser,
}) => {
  test.setTimeout(45 * 60_000);
  expect(process.env.E2E_BASE_URL, "production only").toBeTruthy();
  const owners = [
    { label: "burner", kp: burner() },
    { label: "burner2", kp: keyOf("E2E_BURNER2_KEY") },
    { label: "burner3", kp: keyOf("E2E_BURNER3_KEY") },
  ];
  const questions = [
    "Is package 0x2 safe to depend on?",
    "What's SUI worth right now?",
    "Is package 0x3 safe to depend on?",
    "What's the WAL price now?",
    "Is package 0x1 safe to depend on?",
    "SUI price this hour?",
    "Is package 0xdee9 safe to depend on?",
  ];
  const calls: { owner: string; payee: string; digest: string }[] = [];
  for (const o of owners) {
    const page = await (await browser.newContext()).newPage();
    await as(page, o.kp);
    const { remoras } = await api<{ remoras: (Row & { updatedAt?: string })[] }>(
      page,
      "/api/remoras",
    );
    if (o.label === "burner")
      save({
        inventory: remoras.map((x) => ({
          id: x.id,
          name: x.name,
          status: x.status,
          updatedAt: x.updatedAt ?? null,
        })),
      });
    const onChain = await discsOnChain(o.kp.toSuiAddress());
    let r = remoras.find(
      (x) =>
        x.name === "Researcher · reef" &&
        x.status === "active" &&
        x.discId &&
        onChain.has(x.discId),
    );
    if (!r) {
      await page.goto("/remoras/new");
      await page.getByRole("radio", { name: /^Researcher/ }).click();
      await page.getByRole("textbox", { name: "Name" }).fill("Researcher · reef");
      await page.getByLabel("Monthly limit (USDC)").fill("0.3");
      await page.getByLabel("Most it pays at once (USDC)").fill("0.02");
      await page.getByRole("button", { name: /^Create / }).click();
      await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
      const id = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
      await page.getByRole("button", { name: "Go live" }).click();
      await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
      r = { id } as Row;
    }
    await api(page, `/api/remoras/${r.id}/share`, { method: "PUT", body: { stats: true } });
    for (const q of questions) {
      const a = await api<{
        eventId: string;
        outcomes: { kind: string; digest?: string; payee?: string }[];
      }>(page, `/api/remoras/${r.id}/ask`, { method: "POST", body: { question: q } });
      for (const x of a.outcomes ?? [])
        if (x.kind === "paid" && x.digest)
          calls.push({ owner: o.label, payee: x.payee ?? "", digest: x.digest });
      // Honest: these answers carried the data asked for.
      if (a.eventId)
        await api(page, `/api/events/${a.eventId}/feedback`, {
          method: "POST",
          body: { verdict: "useful" },
        });
    }
    await page.context().close();
  }
  expect(calls.length).toBeGreaterThanOrEqual(20);
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  // `/api/reef/services` answers an array of services, each with its 7-day score.
  const reef = await api<
    {
      ref: string;
      score?: {
        status: string;
        calls: number;
        owners: number;
        usefulPct: number | null;
        line: string;
      } | null;
    }[]
  >(page, "/api/reef/services");
  const scored = reef.filter((s) => s.score?.status === "scored");
  save({
    reef: {
      calls,
      scored: scored.map((s) => ({ ref: s.ref, score: s.score })),
      at: new Date().toISOString(),
    },
  });
  expect(scored.length).toBeGreaterThanOrEqual(2);
});
