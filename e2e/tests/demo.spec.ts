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
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  type Browser,
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { burner } from "../support/env";
import { installTestWallet, WALLET_NAME } from "../support/test-wallet";

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
        },
        null,
        1,
      ),
    );
  }
}

/** A page at the demo's size, as a fresh client so the local per-address limits never show. */
async function newPage(browser: Browser, wallet: boolean) {
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: DPR,
    colorScheme: THEME,
  });
  await context.setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await context.addInitScript((t) => localStorage.setItem("remora.theme", t), THEME);
  const page = await context.newPage();
  if (wallet) await installTestWallet(page, burner());
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
  config: { budget?: unknown };
};
async function remoras(page: Page): Promise<R[]> {
  return page.evaluate(async () => {
    const res = await fetch("/api/remoras", { headers: { "x-remora-network": "testnet" } });
    return res.ok ? ((await res.json()) as { remoras: R[] }).remoras : [];
  });
}

/** The testnet Disc package: Scout's sui-risk report on it is a real finding (a single-address upgrade cap). */
const QUESTION =
  "Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d safe to depend on?";

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

  // 1. A first visit: no wallet, a $1 Disc, a paid answer over x402, a receipt that verifies.
  const visitor = await newPage(browser, false);
  await visitor.goto("/");
  await shot("playground", visitor, async (s) => {
    await s.hold(1200, "home");
    await s.box("what-is-remora", s.page.getByTestId("what-is-remora"));
    await s.hold(3200, "what-is-remora");
    await s.click(s.page.getByTestId("home-try-scout"), "Try Scout, no wallet");
    await expect(s.page.getByTestId("playground-intro")).toBeVisible({ timeout: 30_000 });
    await s.hold(1500, "intro");
    await s.click(s.page.getByRole("button", { name: /Start my Scout/ }), "Start my Scout");
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
    await s.click(s.page.getByRole("button", { name: /Ask Scout/ }), "Ask Scout");
    s.mark("asked");
    await expect(s.page.getByTestId("playground-answer").first()).toContainText(
      "Paid 0.01 USDC to Sui risk check",
      {
        timeout: 180_000,
      },
    );
    s.mark("answered");
    await s.box("paid", s.page.getByText(/Paid 0.01 USDC to Sui risk check/).first());
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

  // 3. A Scout with its own Disc from one signature, then live. (The suite's global setup revokes
  // leftover Discs, so the demo makes a fresh one rather than reusing an old Scout.)
  let created = "";
  await shot("create", owner, async (s) => {
    await go(s, "/remoras/new");
    await s.hold(1500, "new");
    await s.click(s.page.getByRole("radio", { name: /^Scout/ }), "Scout");
    await s.page.getByLabel("Name").fill("");
    await s.type(s.page.getByLabel("Name"), "Scout · demo", "name");
    await s.page.getByLabel("Monthly limit (USDC)").fill("");
    await s.type(s.page.getByLabel("Monthly limit (USDC)"), "0.5", "monthly");
    await s.page.getByLabel("Most it pays at once (USDC)").fill("");
    await s.type(s.page.getByLabel("Most it pays at once (USDC)"), "0.015", "per payment");
    await s.hold(800);
    await s.click(s.page.getByRole("button", { name: "Create Scout" }), "Create Scout");
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
      const ignored = s.page.getByText(/Ignored: Received/).first();
      if (await shows(ignored, 3_000)) {
        await s.to(ignored, "ignored");
        await s.hold(2500, "ignored");
      }
      await s.click(s.page.getByRole("tab", { name: "Learning" }), "Learning");
      await s.hold(5000, "learning");
    });

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
  expect(done).toEqual(expect.arrayContaining(only ?? ["playground", "create", "scout"]));
});
