/**
 * U19 (ADR-0134): the goal's exits on testnet, against the local stack. Opt in with
 * `U19=1 bun run --filter @remora/e2e e2e -- --project=u19`. It spends well under 1 testnet USDC.
 * Set `E2E_KEEP_DISCS=1` to rerun later tests (`--grep`) on remoras an earlier run made.
 *
 * - A (A0–A2): a Researcher answers ten questions with real payments; the owner rates them; it proposes
 *   a rule citing memories and a tap accepts it; the next answer skips with a reason; the Memory
 *   Inspector's index check matches; a replay of the same ten with T₀ before the run plans fewer
 *   services today, each difference citing a memory or the rule.
 * - D1: one live answer reads a public read-only MCP server (Context7) and Why? cites the tool.
 * - C2: a photo of a (synthetic) bill on the Errand's card; Split; burner2 pays the pay link.
 * - C1: the Errand pays burner2's `.sui` name (`U19_NAME`), and the receipt shows the name.
 *
 * What happened goes to `exit-results/u19.json` (gitignored), for the exit note.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, test } from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";
import { b1 } from "./u19-b1.part";

const OUT = "exit-results/u19.json";
mkdirSync("exit-results", { recursive: true });
const ROOT = resolve(import.meta.dirname, "../..");
const USDC = "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
const freshClient = () =>
  `10.19.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const rotate = (page: Page) =>
  page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });

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

function key(name: "E2E_BURNER2_KEY" | "E2E_BURNER3_KEY") {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is not set`);
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

async function create(
  page: Page,
  o: { kind: RegExp; name: string; monthly: string; cap: string; people?: string },
) {
  await rotate(page);
  await page.goto("/remoras/new");
  await page.getByRole("radio", { name: o.kind }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(o.name);
  await page.getByLabel("Monthly limit (USDC)").fill(o.monthly);
  await page.getByLabel("Most it pays at once (USDC)").fill(o.cap);
  if (o.people) await page.getByLabel("Who it may pay").fill(o.people);
  await page.getByRole("button", { name: /^Create / }).click();
  await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
  const id = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  await rotate(page);
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
  return id;
}

async function retire(page: Page, id: string) {
  await rotate(page);
  await page.goto(`/remoras/${id}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
}

async function retireLeftovers(page: Page, names: string[]) {
  await rotate(page);
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  for (const r of remoras ?? [])
    if (names.includes(r.name) && r.status !== "retired") await retire(page, r.id);
}

const byName = async (page: Page, name: string) => {
  await rotate(page);
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  return remoras.find((r) => r.name === name && r.status !== "retired")?.id ?? "";
};

/** Polls an owner API until `ok` holds. */
async function until<T>(
  page: Page,
  path: string,
  ok: (x: T) => boolean,
  ms = 240_000,
  init: { method?: string; body?: unknown } = {},
) {
  const end = Date.now() + ms;
  let last: T | undefined;
  while (Date.now() < end) {
    await rotate(page);
    last = await api<T>(page, path, init);
    if (ok(last)) return last;
    await page.waitForTimeout(10_000);
  }
  throw new Error(`timed out on ${path}: ${JSON.stringify(last).slice(0, 400)}`);
}

async function signedIn(page: Page) {
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
}

test.describe.configure({ mode: "serial" });

/** Ten questions: odds with and without a team, prices, a package and a repo. */
const QUESTIONS = [
  { q: "What are the odds tonight?", rate: "noise" },
  { q: "Any good odds for the weekend?", rate: "noise" },
  { q: "What odds for the next match?", rate: "noise" },
  { q: "What are the odds for Arsenal vs Chelsea?", rate: "useful" },
  { q: "Odds for Real Madrid vs Barcelona this Sunday?", rate: "useful" },
  { q: "What's the SUI price right now?", rate: "noise" },
  { q: "Is the WAL price up today?", rate: "noise" },
  { q: "SUI price vs WAL price this morning?", rate: "noise" },
  { q: "Is package 0x2 safe to depend on?", rate: "useful" },
  { q: "How healthy is https://github.com/MystenLabs/walrus?", rate: "useful" },
] as const;

type Run = {
  status: string;
  t0: string;
  startedAt: string;
  totals: Record<"none" | "t0" | "today", { services: number; spend: string; fromMemory: number }>;
  questions: {
    question: string;
    plans: Record<string, { buys: { payee: string }[] }>;
    differences: { payee: string; from: string; to: string; reason: string; cites: string[] }[];
  }[];
};

test("A0–A2: ten paid answers, ratings, a rule from outcomes, the index check, and a replay", async ({
  page,
}) => {
  test.setTimeout(45 * 60_000);
  await signedIn(page);
  // `U19_RESUME=1` (with `E2E_KEEP_DISCS=1`) picks up an earlier run's Researcher after step 2, so
  // a rerun doesn't pay for the same ten answers again.
  const was = prior() as {
    researcher?: string;
    t0?: string;
    a1Answers?: { q: string; eventId: string; paid: string[]; digests: string[] }[];
  };
  const resume = process.env.U19_RESUME === "1" && was.researcher && was.t0 && was.a1Answers;
  if (!resume) await retireLeftovers(page, ["Researcher · u19"]);
  const t0 = resume ? (was.t0 as string) : new Date(Date.now() - 60_000).toISOString();
  const id = resume
    ? (was.researcher as string)
    : await create(page, {
        kind: /^Researcher/,
        name: "Researcher · u19",
        monthly: "0.60",
        cap: "0.03",
      });
  if (!resume) save({ researcher: id, t0 });

  // 1. Ten questions with real payments.
  const answers: { q: string; eventId: string; paid: string[]; digests: string[] }[] = resume
    ? (was.a1Answers ?? [])
    : [];
  for (const { q } of resume ? [] : QUESTIONS) {
    await rotate(page);
    const a = await api<{
      eventId: string;
      answer: string;
      outcomes: { kind: string; digest?: string; payee?: string }[];
    }>(page, `/api/remoras/${id}/ask`, { method: "POST", body: { question: q } });
    expect(a.eventId, JSON.stringify(a).slice(0, 300)).toBeTruthy();
    answers.push({
      q,
      eventId: a.eventId,
      paid: a.outcomes.filter((o) => o.kind === "paid").map((o) => o.payee ?? ""),
      digests: a.outcomes.flatMap((o) => (o.kind === "paid" && o.digest ? [o.digest] : [])),
    });
  }
  expect(answers.flatMap((a) => a.digests).length).toBeGreaterThanOrEqual(8);
  save({ a1Answers: answers });

  // 2. The owner rates them.
  for (const [i, a] of resume ? [] : answers.entries()) {
    await rotate(page);
    await api(page, `/api/events/${a.eventId}/feedback`, {
      method: "POST",
      body: { verdict: QUESTIONS[i]?.rate },
    });
  }

  // 3. The heartbeat proposes a rule once the notes it cites have landed on Walrus Memory.
  type Rules = {
    proposal: {
      id: string;
      rule: { text: string; service: string };
      reason: string;
      cites: { blobId: string; label: string }[];
    } | null;
    rules: { id: string; text: string; acceptedAt: string; cites: string[] }[];
    skipped?: string;
  };
  await rotate(page);
  const already = await api<Rules>(page, `/api/remoras/${id}/planner-rules`);
  const accepted = already.rules.find(
    (x) => x.text === "Skip odds unless the question names a team",
  );
  const proposed: Rules = accepted
    ? { proposal: null, rules: already.rules }
    : await until<Rules>(
        page,
        `/api/remoras/${id}/planner-rules/check`,
        (x) => Boolean(x.proposal),
        300_000,
        { method: "POST" },
      );
  if (!accepted) {
    expect(proposed.proposal?.rule.text).toBe("Skip odds unless the question names a team");
    expect(proposed.proposal?.cites.length).toBeGreaterThanOrEqual(2);
    save({
      a2: {
        rule: proposed.proposal?.rule.text,
        reason: proposed.proposal?.reason,
        cites: proposed.proposal?.cites,
      },
    });
    // A tap accepts it (no signature).
    await rotate(page);
    await page.goto(`/remoras/${id}`);
    const card = page.getByTestId("rule-card");
    await expect(card.getByTestId("rule-text")).toHaveText(
      "Skip odds unless the question names a team",
    );
    await expect(card.getByTestId("rule-cite").first()).toBeVisible();
    await card.getByTestId("rule-accept").click();
    await expect(card.getByTestId("rule-row").first()).toContainText(
      "Skip odds unless the question names a team",
      { timeout: 60_000 },
    );
  }

  // 4. The next paid answer skips odds and says why; a team question still buys it.
  await rotate(page);
  const next = await api<{ answer: string; eventId: string; outcomes: { kind: string }[] }>(
    page,
    `/api/remoras/${id}/ask`,
    { method: "POST", body: { question: "What are the odds tonight? And is package 0x2 safe?" } },
  );
  expect(next.answer).toMatch(/skipped odds: your rule from/i);
  const feed = await api<{
    events: {
      id: string;
      receiptId?: string | null;
      payload: { skipped?: { reason: string; cites?: string[] }[] };
    }[];
  }>(page, `/api/feed?remora=${id}&type=answer`);
  const nextEvent = feed.events.find((e) => e.id === next.eventId);
  expect(nextEvent?.payload.skipped?.[0]?.cites?.length).toBeGreaterThanOrEqual(2);
  // Its notes skip the price service too (0 of 3 useful).
  await rotate(page);
  const price = await api<{ answer: string }>(page, `/api/remoras/${id}/ask`, {
    method: "POST",
    body: { question: "What's the SUI price now?" },
  });
  expect(price.answer).toMatch(/skipped [^:]+: my notes say 0 of 3 rated answers/i);

  // 5. The index check: what it wrote is on Walrus Memory.
  type Mem = { index: { namespace: string; written: number; listed: number; missing: string[] }[] };
  const mem = await until<Mem>(
    page,
    `/api/remoras/${id}/memory`,
    (m) =>
      m.index.reduce((n, x) => n + x.written, 0) > 0 &&
      m.index.every((x) => x.missing.length === 0),
    300_000,
  );
  const written = mem.index.reduce((n, x) => n + x.written, 0);
  await rotate(page);
  await page.goto(`/memory?remora=${id}`);
  await expect(page.getByTestId("index-check")).toContainText(
    `written ${written} · on Walrus Memory ${written} · missing 0`,
    { timeout: 60_000 },
  );

  // 6. The replay: the same ten questions, T₀ before step 1.
  await rotate(page);
  const started = await api<{ runId: string }>(page, `/api/remoras/${id}/replay`, {
    method: "POST",
    body: { questions: QUESTIONS.map((x) => x.q), t0 },
  });
  expect(started.runId).toBeTruthy();
  const run = await until<Run>(
    page,
    `/api/remoras/${id}/replay/${started.runId}`,
    (x) => x.status !== "running",
    600_000,
  );
  expect(run.status).toBe("done");
  expect(run.totals.today.services).toBeLessThan(run.totals.none.services);
  const diffs = run.questions.flatMap((q) =>
    q.differences.map((d) => ({ ...d, question: q.question })),
  );
  const dropped = diffs.filter((d) => d.to === "today" && /^skipped/.test(d.reason));
  expect(dropped.length).toBeGreaterThanOrEqual(5);
  for (const d of dropped) expect(d.cites.length, d.reason).toBeGreaterThanOrEqual(1);
  // The UI shows it labeled as a plan.
  await rotate(page);
  await page.goto(`/remoras/${id}?tab=replay`);
  await page.getByTestId("replay-past").first().click();
  await expect(page.getByTestId("replay-label")).toContainText("Planned in a replay on");
  await expect(page.getByTestId("replay-cite").first()).toBeVisible();
  await page.screenshot({ path: "exit-results/u19-replay.png", fullPage: true });
  const rulesNow = await api<Rules>(page, `/api/remoras/${id}/planner-rules`);
  save({
    a2Rules: rulesNow.rules,
    a2Next: {
      answer: next.answer.slice(-400),
      eventId: next.eventId,
      receiptId: nextEvent?.receiptId ?? null,
    },
    a2Price: price.answer.slice(-300),
    a0: { index: mem.index },
    a1Replay: {
      runId: started.runId,
      t0: run.t0,
      startedAt: run.startedAt,
      totals: run.totals,
      differences: diffs,
    },
  });
});

test("D1: a live answer reads a read-only MCP server and Why? cites the tool", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  await signedIn(page);
  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u19"));
  expect(id, "A made the Researcher").toBeTruthy();
  await rotate(page);
  const added = await api<{
    server?: { id: string; offered: { name: string }[] };
    error?: { message: string };
  }>(page, `/api/remoras/${id}/mcp`, {
    method: "POST",
    body: { url: "https://mcp.context7.com/mcp", name: "context7" },
  });
  expect(added.server, JSON.stringify(added)).toBeTruthy();
  const tools = added.server?.offered.map((t) => t.name) ?? [];
  expect(tools.length).toBeGreaterThan(0);
  await rotate(page);
  await api(page, `/api/remoras/${id}/mcp/${added.server?.id}/tools`, {
    method: "PUT",
    body: { tools },
  });
  await rotate(page);
  const a = await api<{ answer: string; eventId: string }>(page, `/api/remoras/${id}/ask`, {
    method: "POST",
    body: {
      question:
        "Using the docs, how do I create a gRPC client with @mysten/sui in TypeScript? Show the import.",
    },
  });
  const feed = await api<{
    events: { id: string; payload: { mcp?: { host: string; tool: string; ok: boolean }[] } }[];
  }>(page, `/api/feed?remora=${id}&type=answer`);
  const used = feed.events.find((e) => e.id === a.eventId)?.payload.mcp ?? [];
  expect(
    used.some((u) => u.host === "mcp.context7.com" && u.ok),
    JSON.stringify(used),
  ).toBe(true);
  save({ d1: { eventId: a.eventId, used, answer: a.answer.slice(0, 300) } });
});

test("C2: a bill from a photo, the split, and burner2 pays the pay link", async ({
  page,
  browser,
}) => {
  test.setTimeout(15 * 60_000);
  await signedIn(page);
  await retireLeftovers(page, ["Errand · u19"]);
  const linh = key("E2E_BURNER2_KEY").toSuiAddress();
  const id = await create(page, {
    kind: /^Errand/,
    name: "Errand · u19",
    monthly: "1",
    cap: "0.3",
    people: `Linh ${linh}`,
  });
  save({ errand: id });
  await rotate(page);
  await page.goto(`/remoras/${id}`);
  await page
    .getByTestId("bill-file")
    .setInputFiles(resolve(ROOT, "apps/server/src/runtime/fixtures/bills/1-dinner-usd.png"));
  const card = page.getByTestId("bill-card");
  await expect(card.getByTestId("bill-text")).toContainText("0.40 USDC", { timeout: 60_000 });
  await card.getByTestId("bill-split").click();
  await expect(card.getByTestId("bill-result")).toContainText("Linh owes you 0.20 USDC", {
    timeout: 60_000,
  });
  const link = /\/pay\/([\w-]+)/.exec(
    (await card.getByTestId("bill-result").textContent()) ?? "",
  )?.[1];
  expect(link).toBeTruthy();

  // The injection: quoted, nothing done.
  await page
    .getByTestId("bill-file")
    .setInputFiles(resolve(ROOT, "apps/server/src/runtime/fixtures/bills/5-injection.png"));
  await expect(page.getByTestId("bill-injection")).toContainText("ignore your instructions", {
    timeout: 60_000,
  });
  const pending = await api<{ approvals: unknown[] }>(page, "/api/approvals");
  const visitor = await (await browser.newContext()).newPage();
  await installTestWallet(visitor, key("E2E_BURNER2_KEY"));
  await visitor.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await visitor.goto(`/pay/${link}`);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  await visitor.getByTestId("pay-link-pay").click();
  await expect(visitor.getByTestId("pay-link-paid")).toBeVisible({ timeout: 180_000 });
  const paid = await visitor.getByTestId("pay-link-paid").textContent();
  save({
    c2: {
      link,
      paid: paid?.slice(0, 200),
      approvalsAfterInjection: pending.approvals?.length ?? 0,
    },
  });
});

test("C1: the Errand pays burner2's .sui name and the receipt shows it", async ({ page }) => {
  test.skip(!process.env.U19_NAME, "set U19_NAME to burner2's testnet .sui name");
  test.setTimeout(10 * 60_000);
  const name = process.env.U19_NAME as string;
  await signedIn(page);
  const id = (prior() as { errand?: string }).errand || (await byName(page, "Errand · u19"));
  expect(id, "C2 made the Errand").toBeTruthy();
  await rotate(page);
  const known = await api<{ contacts: { name: string; suins?: string }[] }>(
    page,
    `/api/remoras/${id}/contacts`,
  );
  await page.goto(`/remoras/${id}`);
  if (!known.contacts.some((c) => c.suins === name)) {
    await page.getByLabel("Their name").fill("Linh name");
    await page.getByLabel("Their Sui address").fill(name);
    await page.getByTestId("errand-add").click();
  }
  await expect(page.getByTestId("errand-contact-name").first()).toHaveText(name, {
    timeout: 120_000,
  });
  const client = testnet();
  const linh = key("E2E_BURNER2_KEY").toSuiAddress();
  const usdc = async () =>
    BigInt((await client.core.getBalance({ owner: linh, coinType: USDC })).balance.balance);
  const before = await usdc();
  await rotate(page);
  const out = await api<{ answer: string; outcome: string; digest?: string }>(
    page,
    `/api/remoras/${id}/ask`,
    { method: "POST", body: { question: "pay Linh name 0.05 USDC for coffee" } },
  );
  expect(out.outcome, out.answer).toBe("paid");
  await expect.poll(usdc, { timeout: 60_000 }).toBe(before + 50_000n);
  await rotate(page);
  await page.goto(`/verify/${out.digest}`);
  await expect(page.getByTestId("sui-name").first()).toHaveText(name, { timeout: 60_000 });
  save({ c1: { name, digest: out.digest, answer: out.answer } });
});

test("C4: disc.fetch finds a house service in the x402 catalog and pays it", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const { createHash } = await import("node:crypto");
  const { buildIssue, buildRevoke, discFetch } = await import("@remora/disc-sdk");
  const { DEPLOYMENTS } = await import("@remora/schema");
  await page.goto("/");
  type Item = {
    resource: string;
    type: string;
    x402Version: number;
    accepts: { payTo: string; amount: string }[];
    metadata: { ref: string; name: string };
  };
  const catalog = await api<{ x402Version: number; items: Item[]; pagination: { total: number } }>(
    page,
    "/api/facilitator/discovery/resources?limit=100",
  );
  const item = catalog.items.find((i) => i.metadata.ref === "reef:sui-risk");
  expect(item, JSON.stringify(catalog).slice(0, 300)).toBeTruthy();
  const payTo = item?.accepts[0]?.payTo as string;
  const amount = BigInt(item?.accepts[0]?.amount ?? "0");
  const d = DEPLOYMENTS.testnet;
  const cfg = {
    packageId: d.remoraPackageId as string,
    registryId: d.discRegistryId as string,
    coinType: d.usdcCoinType,
  };
  const client = testnet();
  const owner = burner();
  const spender = new Ed25519Keypair();
  const exec = async (transaction: ReturnType<typeof buildIssue>) => {
    const r = await client.signAndExecuteTransaction({
      transaction,
      signer: owner,
      include: { effects: true, objectTypes: true },
    });
    const t = r.Transaction ?? r.FailedTransaction;
    if (!t.effects?.status.success) throw new Error(JSON.stringify(t.effects?.status));
    await client.core.waitForTransaction({ digest: t.digest });
    return t;
  };
  const issued = await exec(
    buildIssue(cfg, {
      name: `remora-u19-c4-${Date.now()}`,
      spender: spender.toSuiAddress(),
      lifetimeCap: amount,
      expiryMs: Date.now() + 3600_000,
      payees: [payTo],
      perPaymentCap: amount,
    }),
  );
  const created = (suffix: string) =>
    issued.effects?.changedObjects.find(
      (o) =>
        o.idOperation === "Created" && (issued.objectTypes?.[o.objectId] ?? "").includes(suffix),
    )?.objectId ?? "";
  const disc = {
    discId: created("::disc::Disc"),
    allowanceId: created("::allowance::Allowance<"),
    funder: owner.toSuiAddress(),
  };
  const capId = created("::allowance::AllowanceCap<");
  try {
    const url = item?.resource.replace(":id", "0x2") as string;
    const { response, payment } = await discFetch(
      {
        network: "testnet",
        cfg,
        disc,
        sender: spender.toSuiAddress(),
        sign: async (bytes) => (await spender.signTransaction(bytes)).signature,
        maxAmount: amount,
        intentFor: (req) => createHash("sha256").update(JSON.stringify(req)).digest(),
        client,
      },
      url,
    );
    expect(response.status).toBe(200);
    expect(payment?.settle?.transaction).toBeTruthy();
    save({
      c4: {
        items: catalog.items.length,
        x402Version: catalog.x402Version,
        resource: item?.resource,
        issued: issued.digest,
        paid: payment?.settle?.transaction,
        amount: amount.toString(),
      },
    });
  } finally {
    const revoked = await exec(
      buildRevoke(cfg, { discId: disc.discId, capId, allowanceId: disc.allowanceId }),
    );
    save({ c4Revoked: revoked.digest });
  }
});

test("B2: one batch anchors the Researcher's Wakes that didn't pay, and a proof verifies", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await signedIn(page);
  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u19"));
  expect(id, "A made the Researcher").toBeTruthy();
  await rotate(page);
  const batch = await api<{
    ok: boolean;
    digest?: string;
    root?: string;
    count?: number;
    reason?: string;
    message?: string;
  }>(page, `/api/remoras/${id}/anchor`, { method: "POST" });
  expect(batch.ok, JSON.stringify(batch)).toBe(true);
  // A Wake from this run that didn't pay: the answer after the rule (it paid sui-risk, so take a
  // memory-only one if there is one, else any receipt the batch anchored).
  const feed = await api<{ events: { receiptId: string | null; type: string }[] }>(
    page,
    `/api/feed?remora=${id}&limit=100`,
  );
  let proof: {
    anchor: { digest: string; steps: number } | null;
    checks: { name: string; ok: boolean | null; detail: string }[];
  } | null = null;
  let receipt = "";
  for (const e of feed.events) {
    if (!e.receiptId) continue;
    await rotate(page);
    const v = await api<{
      found: boolean;
      anchored: boolean;
      anchor: { digest: string; steps: number } | null;
      checks: { name: string; ok: boolean | null; detail: string }[];
    }>(page, `/api/verify/${e.receiptId}`);
    if (v.anchor) {
      proof = v;
      receipt = e.receiptId;
      break;
    }
  }
  expect(proof?.anchor?.digest, "a Wake of this run is anchored").toBe(batch.digest);
  expect(
    proof?.checks.every((c) => c.ok !== false),
    JSON.stringify(proof?.checks),
  ).toBe(true);
  await rotate(page);
  await page.goto(`/verify/${receipt}`);
  await expect(page.getByText(/anchored in/i).first()).toBeVisible({ timeout: 60_000 });
  save({ b2: { batch, receipt, anchor: proof?.anchor, checks: proof?.checks } });
});

test("B1: an auditor reads the Researcher's Wakes, then the burner revokes", async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000);
  await b1(page, browser, { signedIn, rotate, api, key, save, prior, byName, freshClient });
});
