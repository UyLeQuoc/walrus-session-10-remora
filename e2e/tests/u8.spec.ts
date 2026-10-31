/**
 * The U8 exit on testnet (ADR-0051, ADR-0052), signed out the whole way:
 * 1. a visitor gets their own Scout with a $1 Disc (the playground wallet, here the burner, signs the
 *    issue); it pays from that Disc and answers with a Wake that /verify checks;
 * 2. the session's question limit refuses plainly;
 * 3. a second visitor gets their own Scout, and the pool (2) refuses a third (checked before the
 *    questions, so the first session is surely still live);
 * 4. the expiry job (3-minute TTL here) revokes the Disc onchain and retires the Scout;
 * 5. /api/health/deep and /lab/health show every item;
 * 6. `diagnose` passes on testnet and fails on a wrong deployment id;
 * 7. the docs' relative links resolve.
 * Timings and digests go to `test-results/u8-exit.json` for docs/spikes.
 */
import { execFile } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { testnet } from "../support/env";

const run = promisify(execFile);
const ROOT = resolve(import.meta.dirname, "../..");
const results: Record<string, unknown> = {};
const ms = (from: number) => Date.now() - from;
/** Per-run visitor addresses, so reruns stay under the per-address day limit. */
const net = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const ip = (n: number) => `${net}.${n}`;

interface Session {
  remoraId: string;
  status: string;
  discId: string | null;
  issueDigest: string | null;
  revokeDigest: string | null;
  spentUsdc: string;
  questionsLeft: number;
  answers: {
    question: string;
    verify: string | null;
    paid: { payee: string; digest: string | null }[];
  }[];
}

/** A visitor: a fresh context with its own address, as the proxy would forward it. */
async function visitor(browser: Browser, ip: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  return { context, page: await context.newPage() };
}

const sessionOf = (page: Page) =>
  page.evaluate(async () => {
    const token = localStorage.getItem("remora.playground");
    const res = await fetch("/api/playground/session", {
      headers: token ? { "x-remora-playground": token } : {},
    });
    return (await res.json()) as { session: Session };
  });

async function until<T>(
  what: string,
  fn: () => Promise<T | null | undefined | false>,
  ms = 300_000,
) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((ok) => setTimeout(ok, 5_000));
  }
}

test("U8 exit: playground with $1 Discs, health, diagnose, docs", async ({ browser }) => {
  test.setTimeout(20 * 60_000);

  // 1. A visitor tries Scout: a $1 Disc, a paid answer, a receipt that verifies.
  const a = await visitor(browser, ip(11));
  await a.page.goto("/playground");
  await expect(a.page.getByTestId("playground-intro")).toContainText("1.00 USDC");
  const t1 = Date.now();
  await a.page.getByRole("button", { name: /Start my Scout/ }).click();
  await expect(a.page.getByTestId("playground-spent")).toHaveText("0.00 of 1.00 USDC", {
    timeout: 120_000,
  });
  results.sessionMs = ms(t1);
  let s = (await sessionOf(a.page)).session;
  results.issueDigest = s.issueDigest;
  results.discId = s.discId;
  expect(s.status).toBe("live");
  // The Disc exists onchain, owned by the playground wallet's Disc package.
  const disc = await testnet().core.getObject({ objectId: s.discId ?? "" });
  expect(disc.object.type).toMatch(/::disc::Disc$/);

  // 3. A second visitor gets their own Scout; the pool (2) refuses a third.
  const b = await visitor(browser, ip(12));
  await b.page.goto("/playground");
  await b.page.getByRole("button", { name: /Start my Scout/ }).click();
  await expect(b.page.getByTestId("playground-spent")).toBeVisible({ timeout: 120_000 });
  const sb = (await sessionOf(b.page)).session;
  expect(sb.remoraId).not.toBe(s.remoraId);
  results.secondIssue = sb.issueDigest;
  const c = await visitor(browser, ip(13));
  await c.page.goto("/playground");
  await expect(c.page.getByText(/Every playground Scout is taken/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(c.page.getByRole("button", { name: /Start my Scout/ })).toBeDisabled();
  await c.context.close();

  const t2 = Date.now();
  await a.page.getByLabel("Your question").fill("Is package 0x2 safe to depend on?");
  await a.page.getByRole("button", { name: /Ask Scout/ }).click();
  await expect(a.page.getByTestId("playground-answer").first()).toContainText(
    "Paid 0.01 USDC to Sui risk check",
    {
      timeout: 180_000,
    },
  );
  results.answerMs = ms(t2);
  s = await until("the paid answer's receipt", async () => {
    const x = (await sessionOf(a.page)).session;
    return x.answers[0]?.verify && x.answers[0]?.paid[0]?.digest ? x : null;
  });
  results.paymentDigest = s.answers[0]?.paid[0]?.digest ?? null;
  results.spentUsdc = s.spentUsdc;
  expect(results.paymentDigest, "Scout paid from its $1 Disc").toBeTruthy();
  expect(s.spentUsdc).toBe("0.01");
  await a.page.screenshot({ path: "screenshots/u8-playground.png", fullPage: true });
  // The answer's Wake checks out.
  const verify = s.answers[0]?.verify ?? "";
  results.verify = verify;
  const verifyPage = await a.context.newPage();
  await verifyPage.goto(verify);
  await expect(verifyPage.getByTestId("verify-verdict")).toContainText("Verified", {
    timeout: 60_000,
  });
  await verifyPage.close();

  // 2. The question limit (2 here) refuses plainly.
  await a.page.getByLabel("Your question").fill("hello");
  await a.page.getByRole("button", { name: /Ask Scout/ }).click();
  await expect(a.page.getByText("That was your last question")).toBeVisible({ timeout: 180_000 });
  const refused = await a.page.evaluate(async () => {
    const token = localStorage.getItem("remora.playground") ?? "";
    const res = await fetch("/api/playground/ask", {
      method: "POST",
      headers: { "content-type": "application/json", "x-remora-playground": token },
      body: JSON.stringify({ question: "one more?" }),
    });
    return {
      status: res.status,
      body: (await res.json()) as { error: { code: string; message: string } },
    };
  });
  expect(refused.status).toBe(409);
  expect(refused.body.error.code).toBe("playground.no_questions");
  results.limitMessage = refused.body.error.message;

  // 4. The session ends: the Disc is revoked onchain and the Scout retired.
  const t4 = Date.now();
  const ended = await until("the onchain revoke", async () => {
    const x = (await sessionOf(a.page)).session;
    return x.status === "retired" && x.revokeDigest ? x : null;
  });
  results.expireMs = ms(t4);
  results.revokeDigest = ended.revokeDigest;
  await expect(
    testnet().core.getObject({ objectId: s.discId ?? "" }),
    "the Disc no longer exists onchain",
  ).rejects.toThrow();
  await a.page.reload();
  await expect(a.page.getByText(/its spending limit is revoked onchain/)).toBeVisible({
    timeout: 30_000,
  });
  await a.page.screenshot({ path: "screenshots/u8-playground-ended.png", fullPage: true });
  await until("the second session's revoke", async () => {
    const x = (await sessionOf(b.page)).session;
    return x.status === "retired" ? x : null;
  });
  await a.context.close();
  await b.context.close();

  // 5. Health: every item, as JSON and on the board.
  const ops = await visitor(browser, ip(14));
  const health = (await (await ops.page.request.get("/api/health/deep")).json()) as {
    status: string;
    items: { name: string; status: string }[];
  };
  const names = health.items.map((i) => i.name);
  for (const want of [
    "database",
    "tatum (testnet)",
    "checkpoint lag (testnet)",
    "facilitator (testnet)",
    "sponsor gas (testnet)",
    "relayer",
    "relayer budget",
    "memory writes",
    "job queue",
    "playground funder",
  ])
    expect(names, `health reports ${want}`).toContain(want);
  results.health = Object.fromEntries(health.items.map((i) => [i.name, i.status]));
  await ops.page.goto("/lab/health");
  await expect(ops.page.getByTestId("health-item")).toHaveCount(health.items.length, {
    timeout: 30_000,
  });
  await ops.page.screenshot({ path: "screenshots/u8-health.png", fullPage: true });
  await ops.context.close();

  // 6. diagnose: passes on testnet, and fails naming the fix on a wrong id.
  const cwd = resolve(ROOT, "apps/server");
  const pass = await run("npx", ["tsx", "scripts/diagnose.ts", "testnet"], {
    cwd,
    env: process.env,
  });
  expect(pass.stdout).toContain("testnet: ok to deploy");
  results.diagnose = pass.stdout.split("\n").filter((l) => l.trim().startsWith("ok")).length;
  const wrong = await run("npx", ["tsx", "scripts/diagnose.ts", "testnet"], {
    cwd,
    env: {
      ...process.env,
      REMORA_DEPLOYMENTS_OVERRIDE: JSON.stringify({
        testnet: {
          discRegistryId:
            process.env.U8_WRONG_ID ??
            "0xb3d76fff500dcd341afefec1168a95fba516ec2e71bfa0e4228d0c03d20ad3d0",
        },
      }),
    },
  }).then(
    () => null,
    (err: { code: number; stdout: string }) => err,
  );
  expect(wrong?.code, "diagnose exits non-zero on a wrong id").toBe(1);
  expect(wrong?.stdout).toContain("FAIL  disc registry");
  expect(wrong?.stdout).toContain("fix: Set DEPLOYMENTS.testnet.discRegistryId");

  save();

  // 7. The docs' links resolve.
  const links = await run("bun", ["scripts/check-links.ts"], { cwd: ROOT });
  results.links = links.stdout.trim();
  save();
});

function save() {
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/u8-exit.json", JSON.stringify(results, null, 2));
  console.log("[u8-exit]", JSON.stringify(results));
}
