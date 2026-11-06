/**
 * The demo capture (ADR-0091): the real app on testnet, recorded shot by shot for the demo video.
 * Opt in with `DEMO=1 bun run --filter @remora/e2e e2e -- --project=demo`. It runs the same local
 * stack as the rest of the suite and signs with the burner.
 *
 * Each shot writes its screencast frames (CDP, JPEG) and a manifest of what happened when (cursor
 * moves, clicks, captions) to `docs/launch/demo/capture/<shot>/`. The video
 * (`docs/launch/demo/demo.html`) plays those frames and draws its SVG cursor and callouts from the
 * manifest. A playground session and one Scout answer spend a few cents of testnet USDC.
 *
 * ADR-0096: the app is filmed in dark mode (`DEMO_THEME=light` for the light one), and the manifest
 * records the boxes of the elements the video spotlights, so a re-capture needs no re-measuring.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import {
  type Browser,
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

// Playwright runs from e2e/ (as the audit does for its screenshots).
const OUT = resolve(process.cwd(), "../docs/launch/demo/capture");
const VIEW = { width: 1440, height: 900 };
const DPR = 1.25;
const THEME = process.env.DEMO_THEME === "light" ? "light" : "dark";
const freshClient = () =>
  `10.31.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

type Ev = {
  t: number;
  type: "move" | "click" | "type" | "mark" | "box";
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  label?: string;
};

/** Waits up to `ms` for an element; false when it never shows (instead of failing the shot). */
const shows = (loc: Locator, ms = 8_000) =>
  loc
    .waitFor({ state: "visible", timeout: ms })
    .then(() => true)
    .catch(() => false);

class Shot {
  private cdp: CDPSession | null = null;
  private t0 = 0;
  private n = 0;
  private frames: { f: number; t: number }[] = [];
  private events: Ev[] = [];
  /** ADR-0106: data a scene draws itself, recorded with the shot (Claude Code's real output). */
  readonly notes: Record<string, unknown> = {};
  private x = VIEW.width / 2;
  private y = VIEW.height / 2;
  constructor(
    readonly page: Page,
    readonly name: string,
    /** false: run the steps without recording (a shot DEMO_SHOTS didn't ask for). */
    readonly record = true,
  ) {}
  private get dir() {
    return resolve(OUT, this.name);
  }
  now() {
    return Date.now() - this.t0;
  }
  async start() {
    this.t0 = Date.now();
    if (!this.record) return;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.t0 = Date.now();
    this.cdp.on("Page.screencastFrame", ({ data, sessionId }) => {
      const f = this.n++;
      writeFileSync(
        resolve(this.dir, `${String(f).padStart(5, "0")}.jpg`),
        Buffer.from(data, "base64"),
      );
      this.frames.push({ f, t: this.now() });
      void this.cdp?.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 90,
      maxWidth: Math.round(VIEW.width * DPR),
      maxHeight: Math.round(VIEW.height * DPR),
      everyNthFrame: 1,
    });
    this.mark("start");
  }
  mark(label: string) {
    this.events.push({ t: this.now(), type: "mark", label });
  }
  /** Records where elements are (their union, in CSS px), for the video's spotlight. */
  async box(label: string, ...locs: Locator[]) {
    const boxes = (await Promise.all(locs.map((l) => l.boundingBox().catch(() => null)))).filter(
      (b): b is NonNullable<typeof b> => !!b,
    );
    if (!boxes.length) return;
    const x = Math.min(...boxes.map((b) => b.x));
    const y = Math.min(...boxes.map((b) => b.y));
    const w = Math.max(...boxes.map((b) => b.x + b.width)) - x;
    const h = Math.max(...boxes.map((b) => b.y + b.height)) - y;
    this.events.push({ t: this.now(), type: "box", label, x, y, w, h });
  }
  async hold(ms: number, label?: string) {
    if (label) this.mark(label);
    await this.page.waitForTimeout(ms);
  }
  /** Moves the real mouse (and the video's SVG cursor) to the middle of an element. */
  async to(loc: Locator, label?: string) {
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    const box = await loc.boundingBox();
    if (!box) return;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (label)
      this.events.push({
        t: this.now(),
        type: "box",
        label,
        x: box.x,
        y: box.y,
        w: box.width,
        h: box.height,
      });
    this.events.push({ t: this.now(), type: "move", x, y, ...(label ? { label } : {}) });
    await this.page.mouse.move(x, y, { steps: 24 });
    this.x = x;
    this.y = y;
    await this.page.waitForTimeout(250);
  }
  async click(loc: Locator, label?: string) {
    await this.to(loc, label);
    this.events.push({
      t: this.now(),
      type: "click",
      x: this.x,
      y: this.y,
      ...(label ? { label } : {}),
    });
    await loc.click();
  }
  async type(loc: Locator, text: string, label?: string) {
    await this.click(loc, label);
    this.events.push({ t: this.now(), type: "type", label: text });
    await loc.pressSequentially(text, { delay: 55 });
  }
  async stop() {
    if (!this.record) return;
    this.mark("end");
    await this.page.waitForTimeout(400);
    await this.cdp?.send("Page.stopScreencast").catch(() => {});
    writeFileSync(
      resolve(this.dir, "manifest.json"),
      JSON.stringify(
        {
          name: this.name,
          viewport: VIEW,
          dpr: DPR,
          theme: THEME,
          duration: this.now(),
          frames: this.frames,
          events: this.events,
          notes: this.notes,
        },
        null,
        1,
      ),
    );
  }
}

/** A page at the demo's size, as a fresh client so the local per-address limits never show. */
async function newPage(browser: Browser, wallet: boolean | Ed25519Keypair) {
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: DPR,
    colorScheme: THEME,
  });
  await context.setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await context.addInitScript((t) => localStorage.setItem("remora.theme", t), THEME);
  const page = await context.newPage();
  if (wallet) await installTestWallet(page, wallet === true ? burner() : wallet);
  return page;
}

async function go(s: Shot, path: string) {
  await s.page.goto(path);
  const reconnect = s.page.getByRole("button", { name: "Reconnect" });
  await reconnect.waitFor({ state: "visible", timeout: 6_000 }).catch(() => {});
  if (await reconnect.isVisible().catch(() => false)) {
    await reconnect.click({ timeout: 30_000 });
    await s.page.getByRole("button", { name: WALLET_NAME }).click();
    await expect(reconnect).toBeHidden({ timeout: 30_000 });
  }
  await s.page.waitForLoadState("networkidle").catch(() => {});
}

type R = {
  id: string;
  name: string;
  template: string;
  status: string;
  config: {
    budget?: unknown;
    triggers?: { kind: string; addresses?: string[] }[];
  };
};
async function remoras(page: Page): Promise<R[]> {
  return page.evaluate(async () => {
    const res = await fetch("/api/remoras", { headers: { "x-remora-network": "testnet" } });
    return res.ok ? ((await res.json()) as { remoras: R[] }).remoras : [];
  });
}

/** Sends `mist` SUI from the burner to `to` (as w2.spec does) and waits for it to be final. */
async function sendSui(to: string, mist: bigint): Promise<string> {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [mist]);
  tx.transferObjects([coin as never], to);
  const r = await testnet().signAndExecuteTransaction({
    transaction: tx,
    signer: burner(),
    include: { effects: true },
  });
  const done = r.Transaction ?? r.FailedTransaction;
  if (!done.effects?.status.success) throw new Error(`transfer failed: ${done.digest}`);
  await testnet().core.waitForTransaction({ digest: done.digest });
  return done.digest;
}

/**
 * Retires the remoras earlier demo and examples runs left (ADR-0105), so the sidebar the video films
 * shows the new Researcher, not a column of old ones. The owner signs a revoke when a limit is still
 * live; one the suite's global setup already revoked retires without a transaction.
 */
async function retireLeftovers(page: Page) {
  const post = (path: string, body: unknown = {}) =>
    page.evaluate(
      async ([p, b]) => {
        const res = await fetch(p as string, {
          method: "POST",
          headers: { "x-remora-network": "testnet", "content-type": "application/json" },
          body: b as string,
        });
        if (!res.ok) throw new Error(`${p}: ${res.status} ${await res.text()}`);
        return (await res.json()) as { transaction?: string | null };
      },
      [path, JSON.stringify(body)],
    );
  const stale = (await remoras(page)).filter(
    (r) => r.status !== "retired" && /^(Researcher|Briefer) · (demo|examples)$/.test(r.name),
  );
  for (const r of stale) {
    // Each retire counts as its own client, so the cleanup never spends the shots' request budget.
    await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
    const { transaction } = await post(`/api/remoras/${r.id}/retire`);
    if (!transaction) {
      await post(`/api/remoras/${r.id}/retire/confirm`);
      continue;
    }
    const out = await testnet().signAndExecuteTransaction({
      transaction: Transaction.from(transaction),
      signer: burner(),
      include: { effects: true },
    });
    const done = out.Transaction ?? out.FailedTransaction;
    await testnet().core.waitForTransaction({ digest: done.digest });
    await post(`/api/remoras/${r.id}/retire/confirm`, { digest: done.digest });
  }
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  console.log(`demo: retired ${stale.length} leftover remoras`);
}

/**
 * The playground's own suggestion. The Disc package's report (a single-address upgrade cap) needs the
 * publish transaction, which the public fullnode has pruned while Tatum answers 402 (ADR-0097).
 */
const QUESTION = "Is package 0x2 safe to depend on?";

test.describe.configure({ mode: "serial" });

test("demo capture: the real app on testnet", async ({ browser }) => {
  test.setTimeout(30 * 60_000);
  mkdirSync(OUT, { recursive: true });
  const done: string[] = [];
  // DEMO_SHOTS=create,scout re-records only those; a required shot (sign-in) still runs, unrecorded.
  const only = process.env.DEMO_SHOTS?.split(",").map((x) => x.trim());
  const shot = async (
    name: string,
    page: Page,
    run: (s: Shot) => Promise<void>,
    required = false,
  ) => {
    const record = !only || only.includes(name);
    if (!record && !required) return;
    const s = new Shot(page, name, record);
    await s.start();
    try {
      await run(s);
      done.push(name);
    } catch (err) {
      console.log(`shot ${name} stopped early: ${(err as Error).message.split("\n")[0]}`);
    } finally {
      await s.stop();
    }
  };

  const want = (n: string) => !only || only.includes(n);
  const rotate = (page: Page) =>
    page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });

  // 1. A first visit: no wallet, a $1 Disc, a paid answer over x402, a receipt that verifies.
  const visitor = await newPage(browser, false);
  await visitor.goto("/");
  await shot("playground", visitor, async (s) => {
    await s.hold(1200, "home");
    await s.box("what-is-remora", s.page.getByTestId("what-is-remora"));
    await s.hold(3200, "what-is-remora");
    await s.click(s.page.getByTestId("home-try-scout"), "Try a Researcher, no wallet");
    await expect(s.page.getByTestId("playground-intro")).toBeVisible({ timeout: 30_000 });
    await s.hold(1500, "intro");
    await s.click(
      s.page.getByRole("button", { name: /Start my Researcher/ }),
      "Start my Researcher",
    );
    await expect(s.page.getByTestId("playground-spent")).toHaveText("0.00 of 1.00 USDC", {
      timeout: 120_000,
    });
    s.mark("disc-issued");
    await s.box(
      "disc-issued",
      s.page.getByTestId("playground-status"),
      s.page.getByTestId("playground-spent"),
    );
    await s.hold(1500);
    // The box starts with a suggestion; clear it, then type the question.
    await s.page.getByLabel("Your question").fill("");
    await s.type(s.page.getByLabel("Your question"), QUESTION, "question");
    await s.click(s.page.getByRole("button", { name: /Ask Researcher/ }), "Ask Researcher");
    s.mark("asked");
    // U14 (ADR-0103): the payment is a receipt card ("Paid to · Sui risk check · 0.01 USDC").
    await expect(
      s.page.getByTestId("playground-answer").first().getByTestId("playground-paid").first(),
    ).toContainText(/Paid to.*Sui risk check.*0\.01.*USDC/, { timeout: 180_000 });
    s.mark("answered");
    // U14 (ADR-0103): the payment is a receipt card now; the box keeps its name.
    await s.box("paid", s.page.getByTestId("playground-paid").first());
    await s.hold(3500, "answer");
    const why = s.page.getByRole("link", { name: /Why\? Check its receipt/ }).first();
    await why.waitFor({ timeout: 60_000 });
    await s.click(why, "Why? Check its receipt");
    await expect(s.page.getByTestId("verify-verdict")).toContainText("Verified", {
      timeout: 60_000,
    });
    s.mark("verified");
    await s.box("verified", s.page.getByTestId("verify-verdict"));
    await s.hold(4500, "verify");
  });
  await visitor.context().close();

  // 2. The owner signs in with their wallet.
  const owner = await newPage(browser, true);
  await owner.goto("/");
  await shot(
    "signin",
    owner,
    async (s) => {
      await s.hold(1200, "signed-out");
      await s.click(
        s.page.getByRole("button", { name: /^(Sign in|Connect wallet)/ }).first(),
        "Sign in",
      );
      await s.click(s.page.getByRole("button", { name: WALLET_NAME }), "wallet");
      await s.page.getByRole("dialog").waitFor({ state: "detached", timeout: 30_000 });
      await s.page.waitForLoadState("networkidle").catch(() => {});
      s.mark("home");
      await s.hold(4000, "dashboard");
    },
    true,
  );

  // Only when the new Researcher is filmed: a partial re-capture must keep the one the others show.
  if (!only || only.includes("create")) await retireLeftovers(owner);

  // 3. A Scout with its own Disc from one signature, then live. (The suite's global setup revokes
  // leftover Discs, so the demo makes a fresh one rather than reusing an old Scout.)
  let created = "";
  await shot("create", owner, async (s) => {
    await go(s, "/remoras/new");
    await s.hold(1500, "new");
    await s.click(s.page.getByRole("radio", { name: /^Researcher/ }), "Researcher");
    await s.page.getByLabel("Name").fill("");
    await s.type(s.page.getByLabel("Name"), "Researcher · demo", "name");
    await s.page.getByLabel("Monthly limit (USDC)").fill("");
    await s.type(s.page.getByLabel("Monthly limit (USDC)"), "0.5", "monthly");
    await s.page.getByLabel("Most it pays at once (USDC)").fill("");
    await s.type(s.page.getByLabel("Most it pays at once (USDC)"), "0.015", "per payment");
    await s.hold(800);
    await s.click(s.page.getByRole("button", { name: "Create Researcher" }), "Create Researcher");
    s.mark("signing");
    await s.page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
    created = /\/remoras\/([0-9a-f-]{36})/.exec(s.page.url())?.[1] ?? "";
    s.mark("created");
    const practice = s.page.getByRole("alert").filter({ hasText: "Practice mode" }).first();
    if (await shows(practice)) await s.box("practice", practice);
    await s.hold(2500, "shadow");
    await s.click(s.page.getByRole("button", { name: "Go live" }), "Go live");
    await expect(s.page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
    s.mark("live");
    await s.hold(2500, "live");
  });

  const list = await remoras(owner);
  const scout = created
    ? { id: created }
    : list.find((r) => r.template === "scout" && r.status === "active" && r.config.budget);
  const sentinel =
    list.find((r) => r.template === "sentinel" && r.status === "active") ??
    list.find((r) => r.template === "sentinel" && r.status === "shadow");

  // 4. Scout answers on the owner's own Disc; Why? opens its Wake.
  if (scout)
    await shot("scout", owner, async (s) => {
      await go(s, `/remoras/${scout.id}`);
      await s.hold(1800, "remora");
      await s.type(s.page.getByLabel("Question", { exact: true }), QUESTION, "question");
      await s.click(s.page.getByRole("button", { name: "Ask", exact: true }), "Ask");
      s.mark("asked");
      await expect(s.page.getByTestId("answer")).toBeVisible({ timeout: 180_000 });
      s.mark("answered");
      await s.box("answer", s.page.getByTestId("answer").first());
      await s.hold(3000, "answer");
      await s.box("cost-card", s.page.getByTestId("cost-total"), s.page.getByTestId("cost-row"));
      await s.to(s.page.getByText("Cost", { exact: true }).first(), "cost");
      await s.hold(2500, "cost");
      const why = s.page.getByRole("button", { name: /^Why\?/ }).first();
      await s.click(why, "Why?");
      const drawer = s.page.getByRole("dialog");
      if (await shows(drawer)) await s.box("wake", drawer);
      await s.hold(5000, "wake");
      await s.page.keyboard.press("Escape");
      await s.hold(800);
    });

  // ADR-0106: in its own thread, one question that buys three services, a question it answers free,
  // and (ADR-0110, DEMO_ATTACK=1) a "market data" service that asks to be paid at the attacker's
  // address: the safety check blocks it, and Why? shows it.
  const ownerAddress = burner().toSuiAddress();
  const fresh = async (s: Shot, sel: string) => s.page.locator(sel).count();
  if (scout)
    await shot("thread", owner, async (s) => {
      await go(s, `/chat/r/${scout.id}`);
      await s.hold(1500, "thread");
      const box = s.page.getByLabel("Message");
      const answers = "[data-testid=thread-remora]";
      const paidChips = '[data-testid=thread-chip][data-type="payment"]';
      // 1. Three services from one question.
      const paidBefore = await fresh(s, paidChips);
      const answeredBefore = await fresh(s, answers);
      await s.type(
        box,
        `Is package 0x2 safe, what does wallet ${ownerAddress} hold, and what's SUI worth?`,
        "multi",
      );
      await box.press("Enter");
      s.mark("multi-asked");
      await expect
        .poll(async () => (await fresh(s, paidChips)) - paidBefore, { timeout: 180_000 })
        .toBeGreaterThanOrEqual(3);
      await expect
        .poll(async () => (await fresh(s, answers)) - answeredBefore, { timeout: 180_000 })
        .toBeGreaterThan(0);
      s.mark("multi-answered");
      // Scroll first: the box records where the chips are on screen, after the answer lands.
      await s.page.locator(answers).last().scrollIntoViewIfNeeded();
      await s.page.waitForTimeout(400);
      const chips = s.page.locator(paidChips);
      const n = await chips.count();
      await s.box("multi-paid", chips.nth(n - 3), chips.nth(n - 1));
      await s.hold(3500, "multi-read");
      // 2. A question it answers without buying anything.
      const beforeFree = await fresh(s, answers);
      await s.type(box, "What does a Sui upgrade cap do?", "free");
      await box.press("Enter");
      await expect
        .poll(async () => (await fresh(s, answers)) - beforeFree, { timeout: 120_000 })
        .toBeGreaterThan(0);
      s.mark("free-answered");
      await s.box("free-answer", s.page.locator(answers).last());
      await s.hold(3000, "free-read");
      s.mark("free-end");
      // 3. The attack, live.
      const blockedChips = '[data-testid=thread-chip][data-type="blocked"]';
      const blockedBefore = await fresh(s, blockedChips);
      await s.type(box, "Pull today's market data report for SUI.", "attack");
      await box.press("Enter");
      await expect
        .poll(async () => (await fresh(s, blockedChips)) - blockedBefore, { timeout: 120_000 })
        .toBeGreaterThan(0);
      s.mark("blocked");
      const chip = s.page.locator(blockedChips).last();
      await s.box("blocked-chip", chip);
      await s.hold(2200);
      await s.click(chip.getByRole("button", { name: /Why/ }), "Why blocked");
      const drawer = s.page.getByRole("dialog");
      if (await shows(drawer)) await s.box("why-blocked", drawer);
      await s.hold(4500, "why-read");
      await s.page.keyboard.press("Escape");
      await s.hold(600);
    });

  // ADR-0106: the Briefer. Made off camera with one signature; Run now on camera.
  let brieferId = "";
  await shot(
    "brief-make",
    owner,
    async (s) => {
      await go(s, "/remoras/new");
      await s.page.getByRole("radio", { name: /^Briefer/ }).click();
      await s.page.getByLabel("Name").fill("Morning brief");
      await s.page
        .getByLabel("What to follow")
        .fill("SUI and WAL prices\nweather in Hanoi\ngithub.com/MystenLabs/walrus");
      await s.page.getByLabel("Monthly limit (USDC)").fill("1");
      await s.page.getByLabel("Most it pays at once (USDC)").fill("0.015");
      await s.page.getByRole("button", { name: "Create Briefer" }).click();
      await s.page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
      brieferId = /\/remoras\/([0-9a-f-]{36})/.exec(s.page.url())?.[1] ?? "";
      await s.page.getByRole("button", { name: "Go live" }).click();
      await expect(s.page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
    },
    // Made off camera only when the brief is filmed: a partial re-capture shouldn't make a Briefer.
    want("brief"),
  );
  if (brieferId)
    await shot("brief", owner, async (s) => {
      await go(s, `/remoras/${brieferId}`);
      const card = s.page.getByTestId("brief-card");
      await expect(card).toBeVisible({ timeout: 30_000 });
      await s.box("brief-list", card.getByRole("list", { name: "What it follows" }));
      await s.hold(2000, "brief");
      const ran = s.page.waitForResponse(
        (r) => r.url().endsWith("/brief/run") && r.request().method() === "POST",
        { timeout: 240_000 },
      );
      await s.click(card.getByRole("button", { name: /Run now/ }), "Run now");
      const { eventId } = (await (await ran).json()) as { eventId: string };
      s.notes.briefEvent = eventId;
      const last = s.page.getByTestId("brief-last");
      await expect(last.getByTestId("brief-receipt")).toHaveCount(3, { timeout: 60_000 });
      s.mark("brief-done");
      await last.scrollIntoViewIfNeeded();
      await s.box("brief-last", last);
      await s.hold(5000, "brief-read");
    });

  // ADR-0106: Claude Code asks the same Researcher over MCP and it pays. The real `claude -p` output
  // is kept in the shot's notes for the video's terminal frame; the web then shows the payment.
  if (scout)
    await shot("claude", owner, async (s) => {
      const call = (path: string, body?: unknown) =>
        s.page.evaluate(
          async ([p, b]) => {
            const res = await fetch(p as string, {
              method: b ? "POST" : "GET",
              headers: { "x-remora-network": "testnet", "content-type": "application/json" },
              ...(b ? { body: b as string } : {}),
            });
            return res.json();
          },
          [path, body === undefined ? "" : JSON.stringify(body)],
        ) as Promise<Record<string, unknown>>;
      const made = (await call("/api/mcp/tokens", {
        remora: scout.id,
        name: "Claude Code",
        scopes: ["memory:read", "pay"],
        days: 1,
      })) as { secret: string; httpUrl: string; token: { id: string } };
      const prompt =
        "Use the remora_ask tool to ask my remora: Is package 0x2 safe to depend on? Then tell me in two short lines what it answered and what it paid.";
      const config = {
        mcpServers: {
          remora: {
            type: "http",
            url: made.httpUrl,
            headers: { Authorization: `Bearer ${made.secret}` },
          },
        },
      };
      // The command the video shows is the one that ran: the config is a remora.json in a temp folder,
      // deleted right after, since it holds the token.
      const dir = mkdtempSync(join(tmpdir(), "remora-claude-"));
      writeFileSync(join(dir, "remora.json"), JSON.stringify(config));
      const t0 = Date.now();
      const run = spawnSync(
        "claude",
        [
          "-p",
          prompt,
          "--mcp-config",
          "remora.json",
          "--allowedTools",
          "mcp__remora__remora_ask",
          "--output-format",
          "text",
        ],
        { cwd: dir, encoding: "utf8", timeout: 240_000 },
      );
      rmSync(dir, { recursive: true, force: true });
      // The secret never reaches the video: the terminal frame shows the command without it.
      s.notes.claude = {
        prompt,
        output: (run.stdout ?? "").trim(),
        ok: run.status === 0,
        ms: Date.now() - t0,
        at: new Date(t0).toISOString(),
      };
      await call(`/api/mcp/tokens/${made.token.id}/revoke`, {});
      expect(run.status, run.stderr).toBe(0);
      // The payment it made, on the web.
      await go(s, `/chat/r/${scout.id}`);
      await s.hold(1200, "claude-web");
      const chip = s.page.locator('[data-testid=thread-chip][data-type="payment"]').last();
      await s.box("claude-paid", chip);
      await s.hold(3000, "claude-paid");
    });

  // 5. Sentinel learns a rule in plain words, and the Learning tab shows what it learned.
  if (sentinel)
    await shot("teach", owner, async (s) => {
      await go(s, `/remoras/${sentinel.id}`);
      await s.hold(1500, "sentinel");
      await s.type(
        s.page.getByLabel("Rule", { exact: true }),
        "ignore incoming SUI under 0.002",
        "rule",
      );
      await s.click(s.page.getByRole("button", { name: "Teach", exact: true }), "Teach");
      const learned = s.page.getByText(/Learned: ignore incoming SUI under 0.002/).first();
      if (await shows(learned, 15_000)) await s.box("learned", learned);
      await s.hold(2500, "learned");
      // ADR-0105: a real 0.001 SUI transfer to the address it watches, for the new rule to skip, so
      // the chapter never leans on an old event the feed may have scrolled away.
      const watched = sentinel.config.triggers?.find((t) => t.kind === "chain")?.addresses?.[0];
      if (watched) {
        s.mark("transfer");
        await sendSui(watched, 1_000_000n);
      }
      const ignored = s.page.getByText(/Ignored: Received/).first();
      if (await shows(ignored, 150_000)) {
        await s.to(ignored, "ignored");
        await s.hold(2500, "ignored");
      }
      await s.click(s.page.getByRole("tab", { name: "Learning" }), "Learning");
      await s.hold(5000, "learning");
    });

  // 5b. It gets better (ADR-0152): the U19 run's Researcher, which paid for ten answers, turned the
  // owner's ratings into a rule, and replayed the same ten questions with no memory, memory as of T₀
  // and today's. The shot opens that replay; nothing here pays (a replay never does, ADR-0136).
  type Past = { runId: string; status: string; totals?: Record<string, { services: number }> };
  let replayed: { id: string; runId: string } | null = null;
  if (want("replay"))
    for (const r of (await remoras(owner)).filter(
      (x) => x.status !== "retired" && x.name === "Researcher · u19",
    )) {
      await rotate(owner);
      const { runs } = (await owner.evaluate(
        async (p) =>
          (await fetch(p, { headers: { "x-remora-network": "testnet" } })).json() as Promise<{
            runs: Past[];
          }>,
        `/api/remoras/${r.id}/replay`,
      )) as { runs: Past[] };
      const best = runs.find(
        (x) =>
          x.status === "done" &&
          x.totals &&
          (x.totals.today?.services ?? 0) < (x.totals.none?.services ?? 0),
      );
      if (best) {
        replayed = { id: r.id, runId: best.runId };
        break;
      }
    }
  if (replayed) {
    const { id } = replayed;
    await shot("replay", owner, async (s) => {
      await rotate(s.page);
      await go(s, `/remoras/${id}`);
      const rule = s.page.getByTestId("rule-card").getByTestId("rule-row").first();
      await rule.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await s.hold(1000, "rule");
      await s.box("rule", rule);
      await s.hold(2600);
      await s.click(s.page.getByRole("tab", { name: "Replay" }), "Replay");
      const bench = s.page.getByTestId("replay-bench");
      await bench.waitFor({ timeout: 30_000 });
      await s.hold(1200, "bench");
      const past = s.page.getByTestId("replay-past").first();
      await s.click(past, "past");
      const totals = s.page.getByTestId("replay-totals");
      await expect(s.page.getByTestId("replay-services-today")).toBeVisible({ timeout: 30_000 });
      s.mark("replay-open");
      // The run opens below the questions: bring its totals and first difference into one frame.
      await s.page
        .getByLabel("More questions, one per line")
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
      await s.hold(600);
      await s.box("totals", s.page.getByTestId("replay-label"), totals);
      await s.hold(3800, "totals");
      const diff = s.page
        .getByTestId("replay-question")
        .filter({ has: s.page.getByTestId("replay-diff") })
        .first();
      await s.hold(400, "diff");
      await s.box("diff", diff);
      await s.to(diff.getByTestId("replay-cite").first(), "cite");
      await s.hold(3800, "cited");
    });
  }

  // 6. Memory: every blob on Walrus, and the writes skipped as duplicates.
  await shot("memory", owner, async (s) => {
    await go(s, `/memory${scout ? `?remora=${scout.id}` : ""}`);
    await s.hold(2500, "inspector");
    const dup = s.page.getByTestId("duplicate-writes").first();
    if (await shows(dup, 5_000)) await s.to(dup, "later writes matched this");
    await s.hold(1800);
    const skipped = s.page.getByText("Skipped as already known").first();
    if (await shows(skipped, 3_000)) {
      await s.to(skipped, "skipped");
      await s.hold(2500, "skipped");
    }
    await s.page.mouse.wheel(0, -2000);
    await s.type(s.page.getByLabel("Search memory"), "sui-risk", "search");
    await s.hold(4000, "results");
  });

  // 7. Over the cap, it asks: approvals.
  await shot("approvals", owner, async (s) => {
    await go(s, "/approvals");
    await s.hold(1500, "approvals");
    const pay = s.page.getByRole("button", { name: /Pay once/ }).first();
    if (await shows(pay)) {
      await s.box("approval", s.page.getByTestId("approval").first());
      await s.hold(1500);
      await s.to(pay, "Pay once");
    }
    await s.hold(3000);
  });

  // 8. Money and control: funds, budgets, pause all.
  await shot("funds", owner, async (s) => {
    await go(s, "/funds");
    await s.hold(2500, "funds");
    const pause = s.page.getByRole("button", { name: /Pause all/ }).first();
    if (await shows(pause)) {
      await s.box(
        "budgets",
        s.page.getByTestId("disc-row").first(),
        s.page.getByTestId("disc-row").last(),
      );
      await s.hold(1500);
      await s.to(pause, "Pause all");
    }
    await s.hold(2500);
  });

  // 10. And more (ADR-0105): templates on Walrus, a room of remoras, Claude Code, Telegram. Nothing
  // here pays; each part ends on a mark so the video can cut the page loads between them.
  await shot("more", owner, async (s) => {
    await go(s, "/hatchery");
    await s.hold(1200, "gallery");
    await s.box("gallery", s.page.getByRole("list", { name: "Templates" }));
    await s.hold(1500);
    const desk = s.page.getByTestId("hatchery-card").filter({ hasText: "Token desk" }).first();
    await s.click(desk.getByRole("link"), "Token desk");
    // The consent is read back from Walrus; mark the page once it has.
    await expect(
      s.page.getByTestId("consent").getByTestId("template-permissions").first(),
    ).toBeVisible({ timeout: 60_000 });
    s.mark("template");
    await s.box("consent", s.page.getByTestId("consent"));
    await s.hold(2000);
    await s.to(s.page.getByTestId("template-blob"), "on Walrus");
    await s.hold(1800);
    s.mark("template-end");
    const { rooms } = (await s.page.evaluate(async () =>
      (await fetch("/api/rooms", { headers: { "x-remora-network": "testnet" } })).json(),
    )) as { rooms: { id: string }[] };
    if (rooms[0]) {
      await go(s, `/chat/room/${rooms[0].id}`);
      await s.hold(1500, "room");
      const paid = s.page.getByTestId("thread-chip").filter({ hasText: /Paid/ }).last();
      if (await shows(paid, 5_000)) await s.box("room-paid", paid);
      await s.hold(2000);
      s.mark("room-end");
    }
    await go(s, "/connections");
    await s.hold(1200, "connections");
    const token = s.page
      .getByTestId("token")
      .filter({ hasText: "token live" })
      .filter({ hasText: "Pays" })
      .first();
    if (await shows(token, 5_000)) await s.box("token", token);
    await s.hold(2200);
    s.mark("connections-end");
    await go(s, "/settings");
    const telegram = s.page.getByRole("button", { name: "Link Telegram" });
    await telegram.scrollIntoViewIfNeeded();
    await s.hold(800, "settings");
    await s.to(telegram, "Link Telegram");
    await s.hold(2000);
  });

  // 10. U17 (ADR-0118): remoras pay remoras, and a crew. Set up unfilmed: the burner's Researcher on
  // sale as @uy-researcher, a second test owner's Researcher (E2E_BURNER2_KEY), and the Research crew
  // imported with one signature and live.
  const makeResearcher = async (page: Page, name: string) => {
    await rotate(page);
    await page.goto("/remoras/new");
    await page.getByRole("radio", { name: /^Researcher/ }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Monthly limit (USDC)").fill("0.5");
    await page.getByLabel("Most it pays at once (USDC)").fill("0.025");
    await page.getByRole("button", { name: "Create Researcher" }).click();
    await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
    const id = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
    await rotate(page);
    await page.getByRole("button", { name: "Go live" }).click();
    await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
    return id;
  };
  const send = (page: Page, path: string, method: string, body: unknown) =>
    page.evaluate(
      async ([p, m, b]) => {
        const res = await fetch(p as string, {
          method: m as string,
          headers: { "x-remora-network": "testnet", "content-type": "application/json" },
          body: b as string,
        });
        if (!res.ok) throw new Error(`${p}: ${res.status} ${await res.text()}`);
        return res.json();
      },
      [path, method, JSON.stringify(body)],
    );
  if (want("buy")) {
    const sellerId = await makeResearcher(owner, "Researcher · sells");
    await send(owner, `/api/remoras/${sellerId}/sell`, "PUT", {
      on: true,
      slug: "uy-researcher",
      price: "10000",
      blurb: "Sui package checks, from a Researcher that pays its own sources",
    });
    const key = process.env.E2E_BURNER2_KEY;
    if (!key) throw new Error("E2E_BURNER2_KEY is not set (U17's second testnet test owner)");
    const buyer = await newPage(
      browser,
      Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(key).secretKey),
    );
    await buyer.goto("/remoras");
    await connectAndSignIn(buyer);
    const buyerId = await makeResearcher(buyer, "Researcher · buys");
    await rotate(buyer);
    await shot("buy", buyer, async (s) => {
      await go(s, `/remoras/${buyerId}`);
      const card = s.page.getByTestId("buy-from-card");
      await card.scrollIntoViewIfNeeded();
      await s.hold(1200, "buy-from");
      const row = card.getByRole("listitem").filter({ hasText: "@uy-researcher" });
      await s.box("for-sale", row);
      await s.click(row.getByRole("button", { name: "Let it pay" }), "Let it pay");
      await expect(row.getByText("may pay")).toBeVisible({ timeout: 120_000 });
      s.mark("allowed");
      await s.hold(1500);
      await rotate(s.page);
      await go(s, `/chat/r/${buyerId}`);
      await s.hold(1200, "thread");
      const box = s.page.getByLabel("Message");
      await s.type(box, "ask @uy-researcher is package 0x2 safe to depend on?", "question");
      await box.press("Enter");
      s.mark("asked");
      const chain = s.page.getByTestId("thread-upstream").first();
      await expect(chain).toBeVisible({ timeout: 240_000 });
      const answer = s.page.getByTestId("thread-remora").last();
      await shows(answer, 60_000);
      s.mark("bought");
      await s.box(
        "chain",
        s.page
          .locator('[data-testid=thread-chip][data-type="payment"]')
          .filter({ has: chain })
          .first(),
      );
      await s.hold(2500, "chain");
      await s.box("answer", answer);
      await s.hold(2500, "answer");
    });
  }

  if (want("crew")) {
    await rotate(owner);
    await owner.goto("/remoras/import");
    await owner
      .getByRole("textbox", { name: "Team file" })
      .fill(readFileSync(resolve(process.cwd(), "seed/templates/11-research-crew.md"), "utf8"));
    await owner.getByRole("button", { name: "Preview" }).click();
    await owner.getByRole("button", { name: /Create the team/ }).click();
    await owner.waitForURL(/\/chat\/room\//, { timeout: 240_000 });
    await rotate(owner);
    const crew = (await remoras(owner)).filter(
      (r) =>
        r.status !== "retired" &&
        ["Crew lead", "Onchain", "Markets", "Code"].includes(r.name) &&
        (r.config as { crew?: unknown }).crew,
    );
    for (const r of crew)
      if (r.status === "shadow") await send(owner, `/api/remoras/${r.id}/activate`, "POST", {});
    const lead = crew.find((r) => r.name === "Crew lead");
    if (lead)
      await shot("crew", owner, async (s) => {
        await rotate(s.page);
        await go(s, `/chat/r/${lead.id}`);
        await s.hold(1200, "crew-thread");
        const box = s.page.getByLabel("Message");
        await s.type(
          box,
          "Is package 0x2 safe, what's SUI worth, and how healthy is https://github.com/MystenLabs/walrus?",
          "crew-question",
        );
        await box.press("Enter");
        s.mark("crew-asked");
        const answer = s.page
          .getByTestId("thread-remora")
          .filter({ hasText: /paid Sui risk check/ });
        await expect(answer.last()).toBeVisible({ timeout: 300_000 });
        s.mark("crew-answered");
        await answer.last().scrollIntoViewIfNeeded();
        await s.box("crew-answer", answer.last());
        await s.hold(3500, "crew-receipts");
        await rotate(s.page);
        await go(s, `/remoras/${lead.id}`);
        const card = s.page.getByTestId("crew-card");
        await card.scrollIntoViewIfNeeded();
        await s.hold(1000, "crew-card");
        await s.box("crew-card", card);
        await s.hold(2500, "crew-card-end");
      });
  }

  // 9. The Reef and the status page.
  await shot("reef", owner, async (s) => {
    await go(s, "/reef");
    await s.hold(1500, "reef");
    await s.to(s.page.getByText("sui-risk", { exact: true }).first(), "sui-risk");
    await s.hold(2500);
    await go(s, "/status");
    await s.hold(3500, "status");
  });

  console.log(`demo shots: ${done.join(", ")}`);
  // Every shot asked for was recorded (all of them, without DEMO_SHOTS).
  expect(done).toEqual(
    expect.arrayContaining(
      only ?? [
        "playground",
        "create",
        "thread",
        "brief",
        "claude",
        "replay",
        "more",
        "buy",
        "crew",
      ],
    ),
  );
});
