/**
 * U18 (ADR-0119): the goal's exits on testnet, against the local stack. Opt in with
 * `U18=1 bun run --filter @remora/e2e e2e -- --project=u18`. It spends well under 1 testnet USDC. To rerun
 * only later tests (`--grep`), set `E2E_KEEP_DISCS=1`: the global setup otherwise revokes the Discs
 * of the remoras an earlier run made.
 *
 * - A1: a Researcher with a tight limit spends most of it, proposes a raise citing its memories, and
 *   the owner accepts with one signature; the new limit is read back from Sui.
 * - B1: an Errand pays a contact (burner2, as "Linh") with a memo; 3x the usual asks first and the
 *   owner's yes lets it pay; over its cap it asks the owner to pay once.
 * - B4: burner2, signed out, buys one answer from the Researcher's public page with its own wallet.
 *
 * What happened goes to `exit-results/u18.json` (gitignored), for the exit note.
 */
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { expect, type Page, test } from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

// Playwright clears test-results/ on every run; one test reads what an earlier run wrote.
const OUT = "exit-results/u18.json";
mkdirSync("exit-results", { recursive: true });
const SLUG = "u18-researcher";
const freshClient = () =>
  `10.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
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

function burner2() {
  const raw = process.env.E2E_BURNER2_KEY;
  if (!raw) throw new Error("E2E_BURNER2_KEY is not set");
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

const ROOT = resolve(import.meta.dirname, "../..");

/** The owner's wallet, in Node: what the page's wallet would sign, signed with the test key. */
async function signRun(kp: Ed25519Keypair, json: string) {
  const client = testnet();
  const tx = Transaction.from(json);
  tx.setSenderIfNotSet(kp.toSuiAddress());
  const bytes = await tx.build({ client });
  const { signature } = await kp.signTransaction(bytes);
  const res = await client.core.executeTransaction({
    transaction: bytes,
    signatures: [signature],
    include: { effects: true },
  });
  const done = res.Transaction ?? res.FailedTransaction;
  if (!done.effects?.status.success) throw new Error(JSON.stringify(done.effects?.status));
  await client.core.waitForTransaction({ digest: done.digest });
  return done.digest;
}

/** Signs in as a test key in its own browser context. */
async function signedIn(browser: import("@playwright/test").Browser, kp: Ed25519Keypair) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await installTestWallet(p, kp);
  await p.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await p.goto("/remoras");
  await connectAndSignIn(p);
  return p;
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
async function until<T>(page: Page, path: string, ok: (x: T) => boolean, ms = 180_000) {
  const end = Date.now() + ms;
  let last: T | undefined;
  while (Date.now() < end) {
    await rotate(page);
    last = await api<T>(page, path);
    if (ok(last)) return last;
    await page.waitForTimeout(5_000);
  }
  throw new Error(`timed out on ${path}: ${JSON.stringify(last).slice(0, 300)}`);
}

const verified = async (page: Page, digest: string) => {
  const v = await api<{ found: boolean; checks: { ok: boolean }[] }>(page, `/api/verify/${digest}`);
  return v.found && v.checks.every((c) => c.ok);
};

test.describe.configure({ mode: "serial" });

test("A1: a remora proposes its own budget, citing memories, and one signature accepts it", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  await retireLeftovers(page, ["Researcher · u18", "Errand · u18"]);
  const id = await create(page, {
    kind: /^Researcher/,
    name: "Researcher · u18",
    monthly: "0.03",
    cap: "0.01",
  });
  save({ researcher: id });
  // One question that buys three services spends about 0.025 of its 0.03.
  await rotate(page);
  await page.goto(`/remoras/${id}`);
  await page
    .getByLabel("Question")
    .first()
    .fill(
      "Is package 0x2 safe to depend on, what's SUI worth, and how healthy is https://github.com/MystenLabs/walrus?",
    );
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 240_000 });

  // Its Wakes land in Walrus Memory in about 24 s; then a check proposes, citing them.
  type Open = { summary: string; cites: { blobId: string; label: string }[]; id: string };
  let open = null as Open | null;
  let skipped = "";
  for (let i = 0; i < 16 && !open; i++) {
    await page.waitForTimeout(15_000);
    await rotate(page);
    const out: { open: Open | null; skipped?: string } = await api(
      page,
      `/api/remoras/${id}/proposals/check`,
      { method: "POST" },
    );
    open = out.open;
    skipped = out.skipped ?? "";
  }
  expect(open, `no proposal (last: ${skipped})`).toBeTruthy();
  expect(open?.summary).toMatch(/^Raise its monthly limit 0\.03 → /);
  expect(open?.cites.length).toBeGreaterThanOrEqual(1);

  await rotate(page);
  await page.goto(`/remoras/${id}?proposal=${open?.id}`);
  const card = page.getByTestId("proposal-card");
  await expect(card.getByTestId("proposal-summary")).toHaveText(open?.summary ?? "");
  await expect(card.getByTestId("proposal-cite").first()).toBeVisible();
  await card.getByTestId("proposal-accept").click();
  await expect(card.getByTestId("proposal-past").first()).toContainText("accepted", {
    timeout: 120_000,
  });
  const after = await api<{ recent: { digest?: string; to: { windowLimit: string } }[] }>(
    page,
    `/api/remoras/${id}/proposals`,
  );
  const accepted = after.recent[0];
  // The new limit, read back from the allowance on Sui.
  const { meter } = await api<{ meter: { window: { limit: string } | null } }>(
    page,
    `/api/remoras/${id}/budget`,
  );
  expect(meter.window?.limit).toBe(accepted?.to.windowLimit);
  save({
    a1: {
      proposal: open?.summary,
      cites: open?.cites,
      digest: accepted?.digest,
      newLimit: meter.window?.limit,
    },
  });
});

test("B1: an Errand pays a contact with a memo, asks before 3x the usual, and asks over its cap", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  const linh = burner2().toSuiAddress();
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const id = await create(page, {
    kind: /^Errand/,
    name: "Errand · u18",
    monthly: "2",
    cap: "0.5",
    people: `Linh ${linh}`,
  });
  save({ errand: id });
  const pay = async (text: string) => {
    await rotate(page);
    return api<{ answer: string; outcome: string; digest?: string; approvalId?: string }>(
      page,
      `/api/remoras/${id}/ask`,
      { method: "POST", body: { question: text } },
    );
  };
  const client = testnet();
  const usdc = async () =>
    BigInt(
      (
        await client.core.getBalance({
          owner: linh,
          coinType:
            "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
        })
      ).balance.balance,
    );
  const before = await usdc();

  const lunch = await pay("pay Linh 0.10 USDC for lunch");
  expect(lunch.outcome, lunch.answer).toBe("paid");
  expect(lunch.answer).toBe("Paid Linh 0.10 USDC for lunch.");
  expect(await verified(page, lunch.digest as string)).toBe(true);

  const big = await pay("pay Linh 0.30 USDC for dinner");
  expect(big.outcome, big.answer).toBe("unusual");
  // The owner's yes in Approvals lets it pay from its own limit.
  await rotate(page);
  await page.goto("/approvals");
  const card = page.getByTestId("approval").filter({ hasText: "Errand · u18" }).first();
  await card.getByRole("button", { name: /^Let it pay/ }).click();
  await expect(page.getByText("Approved.")).toBeVisible({ timeout: 180_000 });
  const feed = await api<{
    events: { type: string; payload: { amount?: string; digest?: string } }[];
  }>(page, `/api/feed?remora=${id}&type=payment`);
  const dinner = feed.events.find((e) => e.payload.amount === "300000");
  expect(dinner?.payload.digest, "the Errand paid the unusual amount").toBeTruthy();

  const over = await pay("pay Linh 0.60 USDC for the concert");
  expect(over.outcome, over.answer).toBe("asked");

  // Linh got 0.10 and then 0.30 from the Errand's Disc.
  await expect.poll(usdc, { timeout: 60_000 }).toBe(before + 400_000n);
  save({
    b1: {
      lunch: lunch.digest,
      dinner: dinner?.payload.digest ?? null,
      unusual: big.answer,
      overCap: over.answer,
      linhGot: "0.40",
    },
  });
});

test("B4: a visitor pays one answer from the public page with their own wallet", async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  // A1's Researcher, from this run or an earlier one.
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  const researcher =
    (prior() as { researcher?: string }).researcher ??
    remoras.find((r) => r.name === "Researcher · u18" && r.status === "active")?.id;
  expect(researcher, "A1 made the Researcher").toBeTruthy();
  await rotate(page);
  await page.goto(`/remoras/${researcher}`);
  const sell = page.getByTestId("sell-card");
  await sell.getByLabel("Its name in the Reef").fill(SLUG);
  await sell.getByLabel("Price per answer, USDC").fill("0.01");
  await sell.getByLabel("One line about it").fill("Package checks, prices and repo health");
  await sell.getByRole("button", { name: "Sell its answers" }).click();
  await expect(page.getByTestId("sell-listed")).toContainText(`@${SLUG}`, { timeout: 30_000 });

  // burner2, signed out, in its own browser.
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await installTestWallet(visitor, burner2());
  await visitor.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await visitor.goto(`/r/${SLUG}`);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  await visitor.getByLabel("Your question").fill("Is package 0x2 safe to depend on?");
  await visitor.getByTestId("public-pay").click();
  const answer = visitor.getByTestId("public-answer");
  await expect(answer).toBeVisible({ timeout: 240_000 });
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
    "the owner got 0.01 USDC",
  ).toBe(true);
  // The seller's page lists the sale with this digest.
  await rotate(page);
  const sale = await api<{ sold: { digest: string | null }[] }>(
    page,
    `/api/remoras/${researcher}/sell`,
  );
  expect(sale.sold.map((s) => s.digest)).toContain(digest);
  save({ b4: { slug: SLUG, digest, buyer: burner2().toSuiAddress() } });
  await ctx.close();
});

test("B3: a split; settle up pays Linh from the Errand and sends a pay link that burner2 pays", async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const errand = (prior() as { errand?: string }).errand || (await byName(page, "Errand · u18"));
  expect(errand, "B1 made the Errand").toBeTruthy();
  const say = async (text: string) => {
    await rotate(page);
    return api<{ answer: string }>(page, `/api/remoras/${errand}/ask`, {
      method: "POST",
      body: { question: text },
    });
  };
  expect((await say("Linh paid 0.30 for coffee for me and Linh")).answer).toContain(
    "You owe Linh 0.15 USDC",
  );
  const owed = await say("settle up");
  expect(owed.answer).toBe("Paid Linh 0.15 USDC for settle up: coffee.");
  expect((await say("I paid 0.40 for lunch for Linh and me")).answer).toContain(
    "Linh owes you 0.20 USDC",
  );
  const link = await say("settle up");
  const url = /\/pay\/([\w-]+)/.exec(link.answer)?.[1];
  expect(url, link.answer).toBeTruthy();

  const visitor = await (await browser.newContext()).newPage();
  await installTestWallet(visitor, burner2());
  await visitor.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await visitor.goto(`/pay/${url}`);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  await visitor.getByTestId("pay-link-pay").click();
  await expect(visitor.getByTestId("pay-link-paid")).toBeVisible({ timeout: 180_000 });
  const pub = await visitor.evaluate(
    async (t) => (await fetch(`/api/public/pay/${t}`)).json(),
    url,
  );
  expect(pub.paidDigest).toBeTruthy();
  save({ b3: { settledLinh: owed.answer, payLink: url, paidDigest: pub.paidDigest } });
  await visitor.context().close();
});

test("B5: MPP-paid calls to a house merchant and to the remora sale door", async ({ page }) => {
  test.setTimeout(8 * 60_000);
  const run = (url: string, payer?: string) => {
    const out = spawnSync("bun", ["scripts/mpp-exit.ts", url], {
      cwd: `${ROOT}/apps/server`,
      env: {
        ...process.env,
        // The script pays as E2E_BURNER_KEY; the sale door's seller is the burner, so burner2 buys.
        ...(payer ? { E2E_BURNER_KEY: payer } : {}),
        MPP_EXIT: "1",
        GAS_STATION: "http://localhost:8798/gas",
        NO_COLOR: "1",
        FORCE_COLOR: "0",
      },
      encoding: "utf8",
      timeout: 180_000,
    });
    // biome-ignore lint/suspicious/noControlCharactersInRegex: strips terminal colours from the log
    const text = `${out.stdout}\n${out.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
    const receipt = /reference: ['"]([1-9A-HJ-NP-Za-km-z]{32,44})['"]/.exec(text)?.[1];
    return { text, receipt, ok: /answer: 200/.test(text) };
  };
  const house = run("http://localhost:8799/weather?city=Hanoi");
  expect(house.ok, house.text.slice(-800)).toBe(true);
  expect(house.text).toMatch(/402: 402 cache-control: no-store/);
  expect(house.receipt, house.text.slice(-800)).toBeTruthy();
  await page.waitForTimeout(31_000); // one question per 30 s per payer at the sale door
  const door = run(
    `http://localhost:8797/api/x402/r/${SLUG}?q=${encodeURIComponent("Is package 0x2 safe?")}`,
    process.env.E2E_BURNER2_KEY,
  );
  expect(door.ok, door.text.slice(-800)).toBe(true);
  expect(door.receipt).toBeTruthy();
  save({ b5: { house: house.receipt, saleDoor: door.receipt } });
});

test("C4 + C5: a signed webhook wakes it, an unsigned one gets 401; a receiver gets payment.settled", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u18"));
  await rotate(page);
  const { hook } = await api<{ hook: { id: string; url: string; secret: string } }>(
    page,
    `/api/remoras/${id}/hooks/in`,
    { method: "POST", body: { name: "u18" } },
  );
  const body = JSON.stringify({
    ref: "refs/heads/main",
    repository: { html_url: "https://github.com/MystenLabs/sui" },
  });
  const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
  const hookUrl = hook.url.replace(/^https?:\/\/[^/]+/, "http://localhost:8797");
  const send = (signed: boolean) =>
    fetch(hookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-forwarded-for": freshClient(),
        ...(signed ? { "x-remora-signature": `sha256=${sig}` } : {}),
      },
      body,
    });
  expect((await send(false)).status).toBe(401);
  const woke = await send(true);
  expect(woke.status).toBe(202);
  const fed = await until<{ events: { type: string; payload: { wokenBy?: { kind?: string } } }[] }>(
    page,
    `/api/feed?remora=${id}&type=answer`,
    (x) => x.events.some((e) => e.payload.wokenBy?.kind === "webhook"),
  );
  expect(fed.events.length).toBeGreaterThan(0);

  // C5: a local receiver gets a signed payment.settled with the real digest.
  const got: { sig: string; body: string }[] = [];
  const server = createServer((req, res) => {
    let b = "";
    req.on("data", (d) => {
      b += d;
    });
    req.on("end", () => {
      got.push({ sig: String(req.headers["remora-signature"] ?? ""), body: b });
      res.end("ok");
    });
  });
  await new Promise<void>((ok) => server.listen(9911, ok));
  try {
    await rotate(page);
    await api(page, `/api/remoras/${id}/hooks/out`, {
      method: "POST",
      body: { url: "http://localhost:9911/hook", events: ["payment.settled"] },
    });
    const { secret } = await api<{ secret: string }>(page, `/api/remoras/${id}/hooks/out/secret`);
    await rotate(page);
    await api(page, `/api/remoras/${id}/ask`, {
      method: "POST",
      // A package id makes the plan buy the risk check, so a payment settles for the hook.
      body: { question: "Is package 0x2 safe to depend on?" },
    });
    const end = Date.now() + 120_000;
    while (Date.now() < end && !got.some((g) => g.body.includes('"payment.settled"')))
      await page.waitForTimeout(2_000);
    const hit = got.find((g) => g.body.includes('"payment.settled"'));
    expect(hit, "a payment.settled delivery").toBeTruthy();
    const [t, v1] = (hit?.sig ?? "").split(",").map((x) => x.split("=")[1]);
    expect(createHmac("sha256", secret).update(`${t}.${hit?.body}`).digest("hex")).toBe(v1);
    const digest = (JSON.parse(hit?.body ?? "{}") as { data?: { digest?: string } }).data?.digest;
    expect(digest).toBeTruthy();
    save({
      c4: { webhook: "202, then an answer woken by the webhook; unsigned 401" },
      c5: { digest },
    });
  } finally {
    server.close();
  }
});

test("A2 + A3: it shares counts with the Reef, and writes a weekly review the next one reads", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u18"));
  await rotate(page);
  await api(page, `/api/remoras/${id}/share`, { method: "PUT", body: { stats: true } });
  await rotate(page);
  await api(page, `/api/remoras/${id}/reviews`, { method: "POST" });
  await page.waitForTimeout(3_000);
  await rotate(page);
  const two = await api<{
    reviews: { id: string; lines: string[]; previousId: string | null; blobId: string | null }[];
  }>(page, `/api/remoras/${id}/reviews`, { method: "POST" });
  const [second, first] = two.reviews;
  expect(second?.previousId).toBe(first?.id);
  const landed = await until<{ reviews: { blobId: string | null }[] }>(
    page,
    `/api/remoras/${id}/reviews`,
    (x) => x.reviews.some((r) => r.blobId),
  );
  await rotate(page);
  const reef = await api<{ ref?: string; score?: { line: string; calls: number } }[]>(
    page,
    "/api/reef/services",
  );
  // The Researcher shares now, so the services it paid this week have counts.
  expect(
    reef.some((x) => x.ref === "reef:sui-risk" && (x.score?.calls ?? 0) > 0),
    JSON.stringify(reef.map((x) => [x.ref, x.score?.line])),
  ).toBe(true);
  save({
    a2: { scores: reef.filter((x) => x.score).map((x) => `${x.ref}: ${x.score?.line}`) },
    a3: { lines: second?.lines, blobId: landed.reviews.find((r) => r.blobId)?.blobId },
  });
});

test("A4: it lends source notes to burner2's remora, which reads them, then can't after a revoke", async ({
  page,
  browser,
}) => {
  test.setTimeout(20 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const lender =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u18"));
  // Its thumbs up writes source scores to its memory: what it will lend.
  await rotate(page);
  const { events } = await api<{ events: { id: string; type: string }[] }>(
    page,
    `/api/feed?remora=${lender}&type=answer`,
  );
  for (const e of events.slice(0, 2)) {
    await rotate(page);
    await api(page, `/api/events/${e.id}/feedback`, {
      method: "POST",
      body: { verdict: "useful" },
    });
  }
  const found = await until<{ memories: { blobId: string; text: string }[] }>(
    page,
    `/api/remoras/${lender}/capsules/lendable?q=SOURCE`,
    (x) => x.memories.some((m) => m.text.includes("SOURCE")),
    240_000,
  );
  const picked = found.memories.filter((m) => m.text.includes("SOURCE")).slice(0, 2);

  const b2 = await signedIn(browser, burner2());
  await retireLeftovers(b2, ["Researcher · u18b"]);
  const grantee = await create(b2, {
    kind: /^Researcher/,
    name: "Researcher · u18b",
    monthly: "0.3",
    cap: "0.02",
  });
  await rotate(b2);
  const g = await api<{ remora: { address: string } }>(b2, `/api/remoras/${grantee}`);

  await rotate(page);
  const lend = await api<{ transaction: string; draft: Record<string, unknown> }>(
    page,
    `/api/remoras/${lender}/capsules`,
    {
      method: "POST",
      body: {
        query: "SOURCE",
        blobIds: picked.map((m) => m.blobId),
        to: g.remora.address,
        days: 3,
      },
    },
  );
  expect(lend.transaction, JSON.stringify(lend)).toBeTruthy();
  const grantDigest = await signRun(burner(), lend.transaction);
  await rotate(page);
  const granted = await api<{ capsuleId: string }>(
    page,
    `/api/remoras/${lender}/capsules/confirm`,
    {
      method: "POST",
      body: { digest: grantDigest, draft: lend.draft },
    },
  );

  await rotate(b2);
  await api(b2, `/api/remoras/${grantee}/capsules/${granted.capsuleId}/accept`, { method: "POST" });
  const ask = async () => {
    await rotate(b2);
    const out = await api<{ eventId: string }>(b2, `/api/remoras/${grantee}/ask`, {
      method: "POST",
      body: { question: "Which sources were worth paying for?" },
    });
    await rotate(b2);
    const feed = await api<{
      events: { id: string; payload: { capsules?: { ok: boolean; reason?: string }[] } }[];
    }>(b2, `/api/feed?remora=${grantee}&type=answer`);
    return feed.events.find((e) => e.id === out.eventId)?.payload.capsules?.[0];
  };
  const read = await ask();
  expect(read, "it read the capsule").toMatchObject({ ok: true });

  await rotate(page);
  const rv = await api<{ transaction: string }>(
    page,
    `/api/remoras/${lender}/capsules/${granted.capsuleId}/revoke`,
    { method: "POST" },
  );
  const revokeDigest = await signRun(burner(), rv.transaction);
  await rotate(page);
  await api(page, `/api/remoras/${lender}/capsules/${granted.capsuleId}/revoke/confirm`, {
    method: "POST",
    body: { digest: revokeDigest },
  });
  const after = await ask();
  expect(after, "the revoke ends it").toMatchObject({ ok: false });
  save({
    a4: {
      capsuleId: granted.capsuleId,
      grant: grantDigest,
      revoke: revokeDigest,
      before: read,
      after,
      grantee,
    },
  });
  await b2.context().close();
});

test("A5: a template carries a public starter pack, and burner2 hatches it with one line", async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u18"));
  await rotate(page);
  const first = await api<{ review: { packCandidates?: { text: string; ok: boolean }[] } }>(
    page,
    `/api/remoras/${id}/share`,
    { method: "POST", body: {} },
  );
  const line = first.review.packCandidates?.find((c) => c.ok)?.text;
  expect(line, JSON.stringify(first.review.packCandidates)).toBeTruthy();
  await rotate(page);
  const review = await api<{ review: { markdown: string; team: { pack?: string[] } } }>(
    page,
    `/api/remoras/${id}/share`,
    { method: "POST", body: { pack: [line] } },
  );
  expect(review.review.team.pack).toEqual([line]);
  await rotate(page);
  const pub = await api<{ transaction: string }>(page, "/api/hatchery/publish", {
    method: "POST",
    body: { markdown: review.review.markdown },
  });
  const pubDigest = await signRun(burner(), pub.transaction);
  await rotate(page);
  const listed = await api<{ listing: { templateId: string } }>(
    page,
    "/api/hatchery/publish/confirm",
    {
      method: "POST",
      body: { digest: pubDigest },
    },
  );
  const tpl = listed.listing.templateId;

  const b2 = await signedIn(browser, burner2());
  await rotate(b2);
  const hatch = await api<{ transaction: string; remoras: string[] }>(
    b2,
    `/api/hatchery/${tpl}/hatch`,
    { method: "POST" },
  );
  const hatchDigest = await signRun(burner2(), hatch.transaction);
  await rotate(b2);
  const done = await api<{ imported?: number; remoras: string[] }>(
    b2,
    `/api/hatchery/${tpl}/hatch/confirm`,
    {
      method: "POST",
      body: { digest: hatchDigest, remoraIds: hatch.remoras, pack: [line] },
    },
  );
  expect(done.imported).toBe(1);
  const mine = done.remoras[0] as string;
  const mem = await until<{ results: { text: string }[] }>(
    b2,
    `/api/remoras/${mine}/memory?q=${encodeURIComponent("SOURCE pack")}`,
    (x) => x.results.some((m) => m.text.includes("SOURCE: pack")),
    240_000,
  );
  save({
    a5: {
      template: tpl,
      publish: pubDigest,
      hatch: hatchDigest,
      line,
      imported: mem.results.find((m) => m.text.includes("SOURCE: pack"))?.text,
    },
  });
  await b2.context().close();
});

test("B2: a Keeper pays a listed API twice, stops on a 20% hike, and pays the new price once accepted", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  const port = 8796;
  const start = (price: string): ChildProcess =>
    spawn("bun", ["src/main.ts"], {
      cwd: `${ROOT}/examples/sell-an-api`,
      env: {
        ...process.env,
        PORT: String(port),
        PRICE: price,
        PAY_TO: burner2().toSuiAddress(),
        FACILITATOR_URL: "http://localhost:8798",
      },
      stdio: "ignore",
    });
  const up = async () => {
    for (let i = 0; i < 40; i++) {
      const r = await fetch(`http://localhost:${port}/haiku?q=walrus`).catch(() => null);
      if (r?.status === 402) return;
      await new Promise((ok) => setTimeout(ok, 500));
    }
    throw new Error("sell-an-api didn't start");
  };
  let api402 = start("5000");
  try {
    await up();
    await installTestWallet(page, burner());
    await page.goto("/remoras");
    await connectAndSignIn(page);
    // List it in the Reef: probe, sign the listing message with the owner's key, list.
    const url = `http://localhost:${port}/haiku?q=walrus`;
    await rotate(page);
    const probe = await api<{ message: string }>(page, "/api/reef/probe", {
      method: "POST",
      body: { url, slug: "haiku-u18" },
    });
    const { signature } = await burner().signPersonalMessage(
      new TextEncoder().encode(probe.message),
    );
    await rotate(page);
    await api(page, "/api/reef/listings", {
      method: "POST",
      body: { url, slug: "haiku-u18", blurb: "A haiku a call", signature },
    });
    await retireLeftovers(page, ["Keeper · u18"]);
    const keeper = await create(page, {
      kind: /^Subscriptions keeper/,
      name: "Keeper · u18",
      monthly: "0.2",
      cap: "0.02",
    });
    save({ keeper });
    const ref = "reef:community-haiku-u18";
    // One signature lets it pay the listed API.
    await rotate(page);
    const r0 = await api<{ remora: { config: { budget: { payees: string[] } } } }>(
      page,
      `/api/remoras/${keeper}`,
    );
    const payees = [...r0.remora.config.budget.payees, ref];
    await rotate(page);
    const ptx = await api<{ transaction: string }>(page, `/api/remoras/${keeper}/payees`, {
      method: "POST",
      body: { payees },
    });
    const pd = await signRun(burner(), ptx.transaction);
    await rotate(page);
    await api(page, `/api/remoras/${keeper}/payees/confirm`, {
      method: "POST",
      body: { digest: pd, payees },
    });
    await rotate(page);
    await api(page, `/api/remoras/${keeper}/subscriptions`, { method: "POST", body: { ref, url } });
    const run = async () => {
      await rotate(page);
      return api<{
        answer: string;
        results: { outcome: string; digest?: string; amount?: string }[];
      }>(page, `/api/remoras/${keeper}/subscriptions/run`, { method: "POST" });
    };
    const one = await run();
    expect(one.results[0], one.answer).toMatchObject({ outcome: "paid", amount: "5000" });
    const two = await run();
    expect(two.results[0], two.answer).toMatchObject({ outcome: "paid", amount: "5000" });

    api402.kill();
    api402 = start("6000");
    await up();
    const hike = await run();
    expect(hike.results[0], hike.answer).toMatchObject({ outcome: "hike", amount: "6000" });
    await rotate(page);
    const subs = await api<{
      subscriptions: { id: string; usual: string }[];
      hikes: { approvalId: string; subscriptionId: string; amount: string }[];
    }>(page, `/api/remoras/${keeper}/subscriptions`);
    const h = subs.hikes[0];
    expect(h?.amount).toBe("6000");
    await rotate(page);
    await api(page, `/api/remoras/${keeper}/subscriptions/${h?.subscriptionId}/accept`, {
      method: "POST",
      body: { amount: h?.amount, approvalId: h?.approvalId },
    });
    const after = await run();
    expect(after.results[0], after.answer).toMatchObject({ outcome: "paid", amount: "6000" });
    save({
      b2: {
        charges: [one, two, after].map((x) => x.results[0]?.digest),
        hike: hike.answer,
      },
    });
  } finally {
    api402.kill();
  }
});

test("C1 + C2 + C3: describe a job; rename from chat (tap) and raise a limit (sign); history restores", async ({
  page,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  await rotate(page);
  const draft = await api<{
    ok: boolean;
    draft?: { template: string; budget?: { payees?: string[] } };
    issues?: unknown[];
    refused?: string;
  }>(page, "/api/remoras/draft", {
    method: "POST",
    body: { text: "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC" },
  });
  expect(draft.ok, JSON.stringify(draft)).toBe(true);
  // It hatches: the draft goes through the ordinary create (and its one signature, if it pays).
  const d = draft.draft as unknown as {
    template: string;
    name: string;
    budget: unknown;
    watch: string[];
    items: string[];
  };
  await retireLeftovers(page, [d.name]);
  await rotate(page);
  const made = await api<{ remora: { id: string; status: string }; transaction: string | null }>(
    page,
    "/api/remoras",
    {
      method: "POST",
      body: {
        template: d.template,
        name: d.name,
        ...(d.budget ? { budget: d.budget } : {}),
        ...(d.watch.length ? { watch: d.watch } : {}),
        ...(d.items.length ? { items: d.items } : {}),
      },
    },
  );
  expect(made.remora?.id, JSON.stringify(made)).toBeTruthy();
  if (made.transaction) {
    const issued = await signRun(burner(), made.transaction);
    await rotate(page);
    await api(page, `/api/remoras/${made.remora.id}/confirm`, {
      method: "POST",
      body: { digest: issued },
    });
  }
  await rotate(page);
  const hatched = await api<{ remora: { status: string; template: string } }>(
    page,
    `/api/remoras/${made.remora.id}`,
  );
  expect(["shadow", "active"]).toContain(hatched.remora.status);
  await rotate(page);
  const refused = await api<{ ok: boolean; refused?: string }>(page, "/api/remoras/draft", {
    method: "POST",
    body: { text: "trade my coins for me every hour" },
  });
  expect(refused.ok).toBe(false);

  const id =
    (prior() as { researcher?: string }).researcher || (await byName(page, "Researcher · u18"));
  const say = async (text: string) => {
    await rotate(page);
    return api<{ eventIds?: string[] }>(page, `/api/remoras/${id}/messages`, {
      method: "POST",
      body: { text },
    });
  };
  const rename = await say("rename Researcher · u18 to Researcher · u18x");
  const card = rename.eventIds?.[0];
  expect(card, JSON.stringify(rename)).toBeTruthy();
  await rotate(page);
  await api(page, `/api/changes/${card}/apply`, { method: "POST" });
  await rotate(page);
  const renamed = await api<{ remora: { name: string } }>(page, `/api/remoras/${id}`);
  expect(renamed.remora.name).toBe("Researcher · u18x");

  // A limit it doesn't have yet, so the card has a change to sign.
  await rotate(page);
  const now = await api<{ meter: { window: { limit: string } | null } }>(
    page,
    `/api/remoras/${id}/budget`,
  );
  const target = now.meter?.window?.limit === "200000" ? "250000" : "200000";
  const raise = await say(
    `raise Researcher · u18x's monthly limit to ${Number(target) / 1e6} USDC`,
  );
  const signCard = raise.eventIds?.[0];
  expect(signCard, JSON.stringify(raise)).toBeTruthy();
  await rotate(page);
  const tx = await api<{ transaction: string }>(page, `/api/changes/${signCard}/tx`, {
    method: "POST",
  });
  const digest = await signRun(burner(), tx.transaction);
  await rotate(page);
  await api(page, `/api/changes/${signCard}/confirm`, { method: "POST", body: { digest } });
  const meter = await until<{ meter: { window: { limit: string } | null } }>(
    page,
    `/api/remoras/${id}/budget`,
    (x) => x.meter?.window?.limit === target,
  );

  // C3: the rename is a version; restoring the one before it brings the name back.
  await rotate(page);
  const history = await api<{ versions: { id: string; fields: string[] }[] }>(
    page,
    `/api/remoras/${id}/history`,
  );
  const renamedAt = history.versions.findIndex((v) => v.fields.includes("name"));
  const before = history.versions[renamedAt + 1];
  expect(before, JSON.stringify(history.versions.slice(0, 4))).toBeTruthy();
  await rotate(page);
  const diff = await api<{ changes: { field: string }[] }>(
    page,
    `/api/remoras/${id}/history/${before?.id}`,
  );
  expect(diff.changes.some((x) => x.field === "name")).toBe(true);
  await rotate(page);
  await api(page, `/api/remoras/${id}/history/${before?.id}/restore`, { method: "POST" });
  await rotate(page);
  const back = await api<{ remora: { name: string } }>(page, `/api/remoras/${id}`);
  expect(back.remora.name).toBe("Researcher · u18");
  save({
    c1: {
      template: draft.draft?.template,
      payees: draft.draft?.budget?.payees,
      refused: refused.refused,
      hatched: made.remora.id,
    },
    c2: { renamed: true, limitDigest: digest, newLimit: meter.meter.window?.limit },
    c3: { restoredFrom: before?.id },
  });
});

test("B6: the burner's statement CSV matches the chain for 10 digests", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  await rotate(page);
  const csv = await page.evaluate(async () => {
    const session = localStorage.getItem("remora.session");
    const res = await fetch("/api/statements/csv?month=2026-11", {
      credentials: "include",
      headers: {
        "x-remora-network": "testnet",
        ...(session ? { "x-remora-session": session } : {}),
      },
    });
    return res.text();
  });
  const [head = "", ...lines] = csv.trim().split("\n");
  const cols = head.split(",");
  const at = (row: string[], name: string) => row[cols.indexOf(name)] ?? "";
  const rows = lines
    .map((l) => l.split(","))
    .filter(
      (r) => at(r, "paid_by") === "remora" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(at(r, "digest")),
    );
  expect(rows.length, "at least 10 remora payments with digests").toBeGreaterThanOrEqual(10);
  const client = testnet();
  const checked: string[] = [];
  for (const r of rows.slice(0, 10)) {
    const res = await client.core.getTransaction({
      digest: at(r, "digest"),
      include: { effects: true, balanceChanges: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    expect(tx?.effects?.status.success).toBe(true);
    const to = normalizeSuiAddress(at(r, "pay_to"));
    expect(
      (tx?.balanceChanges ?? []).some(
        (b) =>
          normalizeSuiAddress(b.address) === to &&
          BigInt(b.amount) === BigInt(at(r, "amount_units")),
      ),
      `${at(r, "digest")} paid ${at(r, "amount_units")} to ${to}`,
    ).toBe(true);
    checked.push(at(r, "digest"));
  }
  save({ b6: { rows: rows.length, checked } });
});
