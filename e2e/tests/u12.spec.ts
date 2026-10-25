/**
 * The U12 exit, Remora's part (F14, ADR-0066/0067), on testnet with the burner as the owner (never a
 * real owner). Claimed for U12 (docs/handoffs/2026-10-25-uy-to-huan-u12-claim.md):
 * 1. the owner makes three tokens on the Connections page: stdio (all scopes), HTTP (all scopes) and
 *    read-only;
 * 2. a stdio client (`packages/mcp`, and Claude Code itself when it can run here) and an HTTP client
 *    each use their own token;
 * 3. remora_remember → the blob lands → remora_recall finds it;
 * 4. pay buys sui-risk within the Disc; its Wake says via mcp:…; wake_verify passes against the chain;
 * 5. pay for odds (over the Disc's 0.015 cap) is refused unsigned; approval_request asks the owner, who
 *    pays it once in the web;
 * 6. the read-only token gets 403 on pay; a revoked token gets 401;
 * 7. the Connections page shows the calls and the spend (desktop and 375 px, light and dark).
 * Results go to `test-results/u12-exit.json`.
 */
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

const API = "http://localhost:8797";
const root = resolve(import.meta.dirname, "../..");
const results: Record<string, unknown> = {};
/** Saved after every step, so a later failure doesn't lose what already ran. */
const save = (file: string) => {
  mkdirSync("test-results", { recursive: true });
  writeFileSync(`test-results/${file}`, JSON.stringify(results, null, 2));
};
const ms = (from: number) => Date.now() - from;

interface ToolResult {
  content?: { text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  tools?: { name: string }[];
  serverInfo?: { name?: string };
}
type Rpc = {
  jsonrpc: "2.0";
  id?: number;
  result?: ToolResult;
  error?: { code: number; message: string };
};

/** Same-origin API reads with the page's own session (as in w2.spec.ts). */
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

/** The app resumes the last approved wallet silently; this is the fallback (as in w2.spec.ts). */
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

/** An HTTP MCP client (Streamable HTTP, JSON responses). */
function httpClient(token: string) {
  let session: string | null = null;
  let n = 0;
  return async (method: string, params?: Record<string, unknown>) => {
    const res = await fetch(`${API}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
        ...(session ? { "mcp-session-id": session, "mcp-protocol-version": "2025-06-18" } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, ...(params ? { params } : {}) }),
    });
    if (method === "initialize") session = res.headers.get("mcp-session-id");
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as Rpc | null };
  };
}

/** The stdio server (`packages/mcp`, v2 proxy) as a child process, one JSON line each way. */
function stdioClient(token: string) {
  const child: ChildProcess = spawn("bun", [resolve(root, "packages/mcp/src/bin.ts")], {
    env: { ...process.env, REMORA_MCP_TOKEN: token, REMORA_API_URL: API },
    stdio: ["pipe", "pipe", "inherit"],
  });
  const waiting = new Map<number, (m: Rpc) => void>();
  let buffer = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const msg = JSON.parse(buffer.slice(0, nl)) as Rpc;
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (typeof msg.id === "number") waiting.get(msg.id)?.(msg);
    }
  });
  let n = 0;
  const send = (method: string, params?: Record<string, unknown>) => {
    const id = ++n;
    return new Promise<Rpc>((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`stdio ${method} timed out`)), 120_000);
      waiting.set(id, (m) => {
        clearTimeout(timer);
        ok(m);
      });
      child.stdin?.write(
        `${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`,
      );
    });
  };
  const notify = (method: string) =>
    child.stdin?.write(`${JSON.stringify({ jsonrpc: "2.0", method })}\n`);
  return { send, notify, close: () => child.kill() };
}

const text = (m: Rpc | null) => String(m?.result?.content?.[0]?.text ?? m?.error?.message ?? "");

/** Makes a token on the Connections page and reads its secret, shown once. */
async function makeToken(page: Page, name: string, scopes: string[]) {
  await goto(page, "/connections");
  await page.getByLabel("Name").fill(name);
  const labels: Record<string, string> = {
    "memory:read": "Read its memory",
    "memory:write": "Write to its memory",
    pay: "Pay through its Disc",
    "approve:request": "Ask you to approve",
  };
  for (const [scope, label] of Object.entries(labels)) {
    const box = page.getByRole("checkbox", { name: label });
    if (((await box.getAttribute("aria-checked")) === "true") !== scopes.includes(scope))
      await box.click();
  }
  await page.getByRole("button", { name: "Create token" }).click();
  const secret = (await page.getByTestId("token-secret").textContent())?.trim() ?? "";
  const stdio = (await page.getByTestId("token-stdio").textContent())?.trim() ?? "";
  await page.getByRole("button", { name: "I've copied it" }).click();
  expect(secret).toMatch(/^rmcp_[A-Za-z0-9_-]{40}$/);
  return { secret, stdio };
}

/** A re-run of only the steps after a fixed failure (the exit runs once): `U12_RESUME_SCOUT=<id>`. */
const RESUME = process.env.U12_RESUME_SCOUT;

test("U12 exit (Remora): agents use a remora through MCP, inside its Disc", async ({ page }) => {
  test.skip(!!RESUME, "resuming after a fixed step");
  test.setTimeout(25 * 60_000);
  const kp = burner();
  await installTestWallet(page, kp);
  results.owner = kp.toSuiAddress();
  results.startedAt = new Date().toISOString();

  // 0. A Scout with a 0.015 cap: sui-risk (0.01) fits, odds (0.02) doesn't.
  await page.goto("/remoras/new");
  await connectAndSignIn(page);
  const stamp = Date.now().toString(36);
  await page.getByRole("radio", { name: /^Scout/ }).click();
  await page.getByLabel("Name").fill(`Scout u12 ${stamp}`);
  await page.getByLabel("Monthly limit (USDC)").fill("0.5");
  await page.getByLabel("Most it pays at once (USDC)").fill("0.015");
  await page.getByRole("button", { name: "Create Scout" }).click();
  await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
  const scoutId = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  results.scoutId = scoutId;
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });

  // 1. Three tokens from the Connections page.
  const stdioTok = await makeToken(page, "Claude Code", [
    "memory:read",
    "memory:write",
    "pay",
    "approve:request",
  ]);
  const httpTok = await makeToken(page, "HTTP script", [
    "memory:read",
    "memory:write",
    "pay",
    "approve:request",
  ]);
  const readTok = await makeToken(page, "Read only", ["memory:read"]);
  results.stdioLine = stdioTok.stdio.replace(stdioTok.secret, "rmcp_…");

  // 2a. The stdio client (packages/mcp → /mcp).
  const stdio = stdioClient(stdioTok.secret);
  const init = await stdio.send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "u12-exit", version: "1" },
  });
  stdio.notify("notifications/initialized");
  expect(init.result?.serverInfo?.name).toBe("remora");
  const stdioTools = ((await stdio.send("tools/list")).result?.tools ?? []).map((t) => t.name);
  results.stdioTools = stdioTools;
  expect(stdioTools).toContain("pay");

  // 3. Remember, then recall the same fact once its blob has landed.
  const fact = `U12 exit ${stamp}: the owner wants a sui-risk check before depending on any package.`;
  const t3 = Date.now();
  const remembered = await stdio.send("tools/call", {
    name: "remora_remember",
    arguments: { type: "episode", text: fact },
  });
  expect(remembered.result?.isError ?? false, text(remembered)).toBe(false);
  results.remember = remembered.result?.structuredContent;
  let recalled: Rpc | null = null;
  await expect
    .poll(
      async () => {
        recalled = await stdio.send("tools/call", {
          name: "remora_recall",
          arguments: {
            query: `sui-risk check before depending on any package ${stamp}`,
            namespace: "me",
          },
        });
        return text(recalled).includes(stamp);
      },
      { timeout: 240_000, intervals: [10_000] },
    )
    .toBe(true);
  results.recallMs = ms(t3);
  const hit = (
    (recalled as Rpc | null)?.result?.structuredContent?.results as { blobId: string }[] | undefined
  )?.[0];
  results.rememberBlob = hit?.blobId ?? null;
  save("u12-exit.json");

  // 2b. Claude Code itself, when it can run here: one read-only tool through the same stdio server.
  const claude = await new Promise<{ ok: boolean; out: string }>((done) => {
    const env = { ...process.env } as Record<string, string | undefined>;
    delete env.CLAUDECODE;
    delete env.CLAUDE_CODE_ENTRYPOINT;
    const config = JSON.stringify({
      mcpServers: {
        remora: {
          command: "bun",
          args: [resolve(root, "packages/mcp/src/bin.ts")],
          env: { REMORA_MCP_TOKEN: stdioTok.secret, REMORA_API_URL: API },
        },
      },
    });
    execFile(
      "claude",
      [
        "-p",
        "Call the remora MCP tool remoras_list once and reply with only the remora's name.",
        "--mcp-config",
        config,
        "--strict-mcp-config",
        "--allowedTools",
        "mcp__remora__remoras_list",
        "--max-turns",
        "3",
        "--output-format",
        "json",
      ],
      { env: env as NodeJS.ProcessEnv, timeout: 180_000, cwd: root },
      (err, stdout, stderr) =>
        done({ ok: !err, out: (stdout || stderr || String(err)).slice(0, 2_000) }),
    );
  });
  results.claudeCode = {
    ran: claude.ok,
    answeredWithRemora: claude.out.includes(`Scout u12 ${stamp}`),
    excerpt: claude.out.replace(stdioTok.secret, "rmcp_…").slice(0, 400),
  };

  // 4. The HTTP client pays sui-risk within the Disc; the Wake says via and verifies.
  const http = httpClient(httpTok.secret);
  expect(
    (await http("initialize", { protocolVersion: "2025-06-18", capabilities: {} })).status,
  ).toBe(200);
  const t4 = Date.now();
  const paid = await http("tools/call", {
    name: "pay",
    arguments: { service: "sui-risk", id: "0x2", reason: "U12 exit: is 0x2 safe to depend on?" },
  });
  expect(paid.status).toBe(200);
  const p = (paid.body?.result?.structuredContent ?? {}) as {
    paid?: boolean;
    digest?: string;
    amount?: string;
    wakeId?: string;
  };
  expect(p?.paid, text(paid.body)).toBe(true);
  results.pay = { digest: p.digest, amount: p.amount, wakeId: p.wakeId, ms: ms(t4) };
  let verified: Rpc | null = null;
  await expect
    .poll(
      async () => {
        verified = (await http("tools/call", { name: "wake_verify", arguments: { ref: p.digest } }))
          .body;
        const v = verified?.result?.structuredContent as {
          anchored?: boolean;
          checks?: { ok: boolean | null }[];
        };
        return Boolean(v?.anchored && v.checks?.every((c) => c.ok !== false));
      },
      { timeout: 180_000, intervals: [5_000] },
    )
    .toBe(true);
  const vs = ((verified as Rpc | null)?.result?.structuredContent ?? {}) as {
    via?: string;
    checks?: unknown[];
  };
  expect(vs.via).toBe("mcp:http-script");
  results.verify = vs;
  save("u12-exit.json");

  // 5. Over the cap: refused unsigned, then the owner pays it once in the web.
  const over = await http("tools/call", {
    name: "pay",
    arguments: { service: "odds", query: "Arsenal vs Chelsea", reason: "U12 exit: tonight's odds" },
  });
  const o = (over.body?.result?.structuredContent ?? {}) as { code?: string; wakeId?: string };
  expect(o?.code, text(over.body)).toBe("over_limit");
  results.overLimit = { code: o.code, wakeId: o.wakeId, text: text(over.body).slice(0, 200) };
  const asked = await http("tools/call", {
    name: "approval_request",
    arguments: { service: "odds", query: "Arsenal vs Chelsea", reason: "U12 exit: tonight's odds" },
  });
  const approvalId =
    (asked.body?.result?.structuredContent as { approvalId?: string })?.approvalId ?? "";
  expect(approvalId, text(asked.body)).toMatch(/^[0-9a-f-]{36}$/);
  results.approvalId = approvalId;
  const t5 = Date.now();
  await goto(page, "/approvals");
  await page
    .getByTestId("approval")
    .filter({ hasText: `Scout u12 ${stamp}` })
    .getByRole("button", { name: /Pay once \(0\.02 USDC\)/ })
    .click();
  await expect(page.getByTestId("approval-answer")).toBeVisible({ timeout: 180_000 });
  results.ownerApprovalMs = ms(t5);
  const feed = await api<{ events: { type: string; payload: Record<string, unknown> }[] }>(
    page,
    `/api/feed?remora=${scoutId}`,
  );
  results.ownerPayment =
    feed.events.find((e) => e.type === "payment" && e.payload.approvedBy === "owner")?.payload
      .digest ?? null;
  const status = await http("tools/call", { name: "approval_request", arguments: { approvalId } });
  results.approvalStatus = (status.body?.result?.structuredContent as { status?: string })?.status;
  expect(results.approvalStatus).toBe("approved");
  save("u12-exit.json");

  // 6. No scope → 403; revoked → 401.
  const ro = httpClient(readTok.secret);
  const denied = await ro("tools/call", {
    name: "pay",
    arguments: { service: "sui-risk", id: "0x2", reason: "x" },
  });
  expect(denied.status).toBe(403);
  results.readOnlyPay = { status: denied.status, message: denied.body?.error?.message };
  save("u12-exit.json");
  await goto(page, "/connections");
  const card = page.getByTestId("token").filter({ hasText: "Claude Code" }).first();
  await card.getByRole("button", { name: "Revoke" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
  await expect(card.locator('[data-slot="badge"]', { hasText: "revoked" })).toBeVisible({
    timeout: 30_000,
  });
  const afterRevoke = await stdio.send("tools/call", { name: "remoras_list", arguments: {} });
  expect(afterRevoke.error?.code).toBe(-32001);
  const direct = await httpClient(stdioTok.secret)("tools/list");
  expect(direct.status).toBe(401);
  results.revoked = { stdio: afterRevoke.error, http: direct.status };
  stdio.close();

  if (process.env.U12_RESUME_FROM !== "retire") {
    // 7. The Connections page: calls and spend, desktop and phone, light and dark.
    const tokens = await api<{
      tokens: { name: string; calls: number; spend: string; memories: number }[];
    }>(page, "/api/mcp/tokens");
    results.tokens = tokens.tokens
      .filter((t) => ["Claude Code", "HTTP script", "Read only"].includes(t.name))
      .slice(0, 3);
    const shot = async (name: string, theme: "light" | "dark", width: number) => {
      await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
      await page.evaluate((t) => localStorage.setItem("remora.theme", t), theme);
      await goto(page, "/connections");
      const http = page.getByTestId("token").filter({ hasText: "HTTP script" }).first();
      await expect(http.getByTestId("token-spend")).toHaveText("0.01 USDC");
      await http.getByRole("button", { name: /Recent calls/ }).click();
      await expect(page.getByTestId("token-calls").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: `screenshots/u12-connections-${name}-${theme}.png`,
        fullPage: true,
      });
    };
    await shot("desktop", "light", 1280);
    await shot("desktop", "dark", 1280);
    await shot("375", "light", 375);
    await shot("375", "dark", 375);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => localStorage.setItem("remora.theme", "light"));
    await goto(page, `/verify/${p.digest}`);
    await expect(page.getByText("MCP: http-script")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "screenshots/u12-verify-via.png", fullPage: true });
  }

  // Retire the Scout so runs don't pile up Discs on the burner (as in w2.spec.ts).
  await goto(page, `/remoras/${scoutId}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });

  results.finishedAt = new Date().toISOString();
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/u12-exit.json", JSON.stringify(results, null, 2));
});

/**
 * The first run passed steps 0–6a and failed on this spec's own locator after the revoke had worked
 * (two elements said "revoked"). This re-runs only what came after, on the same Scout: a revoked
 * token gets 401 over stdio and HTTP, the Connections screenshots, the Wake's "Via", and the retire.
 */
test("U12 exit (Remora), resumed: revoke → 401, the Connections page, retire", async ({ page }) => {
  test.skip(!RESUME, "only when resuming");
  test.setTimeout(15 * 60_000);
  const scoutId = RESUME as string;
  const digest = process.env.U12_RESUME_DIGEST ?? "";
  const kp = burner();
  await installTestWallet(page, kp);
  await page.goto("/connections");
  await connectAndSignIn(page);
  results.resumedAt = new Date().toISOString();
  results.scoutId = scoutId;

  // 6b. A token used over stdio, revoked in the web, then refused (401) over both transports. The
  // second resume (after the limiter fix) starts at the screenshots: U12_RESUME_FROM=shots; the third
  // (after the retire fix) at the retire: U12_RESUME_FROM=retire.
  if (!process.env.U12_RESUME_FROM) {
    const tok = await makeToken(page, "Revoke check", ["memory:read"]);
    const stdio = stdioClient(tok.secret);
    const init = await stdio.send("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "u12-exit", version: "1" },
    });
    expect(init.result?.serverInfo?.name).toBe("remora");
    const before = await stdio.send("tools/call", { name: "remoras_list", arguments: {} });
    expect(before.result?.isError ?? false).toBe(false);
    await goto(page, "/connections");
    const card = page.getByTestId("token").filter({ hasText: "Revoke check" }).first();
    await card.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Revoke" }).click();
    await expect(card.locator('[data-slot="badge"]', { hasText: "revoked" })).toBeVisible({
      timeout: 30_000,
    });
    const afterRevoke = await stdio.send("tools/call", { name: "remoras_list", arguments: {} });
    expect(afterRevoke.error?.code).toBe(-32001);
    const direct = await httpClient(tok.secret)("tools/list");
    expect(direct.status).toBe(401);
    results.revoked = { stdio: afterRevoke.error, http: direct.status, body: direct.body?.error };
    stdio.close();
    save("u12-exit-resume.json");
  }

  // 7. The Connections page: calls and spend, desktop and phone, light and dark.
  const tokens = await api<{
    tokens: {
      name: string;
      calls: number;
      spend: string;
      memories: number;
      revokedAt: string | null;
    }[];
  }>(page, "/api/mcp/tokens");
  results.tokens = tokens.tokens;
  const shot = async (name: string, theme: "light" | "dark", width: number) => {
    await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
    await page.evaluate((t) => localStorage.setItem("remora.theme", t), theme);
    await goto(page, "/connections");
    const http = page.getByTestId("token").filter({ hasText: "HTTP script" }).first();
    await expect(http.getByTestId("token-spend")).toHaveText("0.01 USDC");
    await http.getByRole("button", { name: /Recent calls/ }).click();
    await expect(page.getByTestId("token-calls").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `no horizontal scroll at ${width}px`).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: `screenshots/u12-connections-${name}-${theme}.png`,
      fullPage: true,
    });
  };
  await shot("desktop", "light", 1280);
  await shot("desktop", "dark", 1280);
  await shot("375", "light", 375);
  await shot("375", "dark", 375);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => localStorage.setItem("remora.theme", "light"));
  if (digest) {
    await goto(page, `/verify/${digest}`);
    await expect(page.getByText("MCP: http-script")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: "screenshots/u12-verify-via.png", fullPage: true });
  }

  // U12_RESUME_FROM=shots-only retakes the screenshots after a UI fix; the Scout is already retired.
  if (process.env.U12_RESUME_FROM !== "shots-only") {
    // Retire the Scout so runs don't pile up Discs on the burner (as in w2.spec.ts).
    await goto(page, `/remoras/${scoutId}`);
    await page.getByRole("tab", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Retire" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
    await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
  }

  results.finishedAt = new Date().toISOString();
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/u12-exit-resume.json", JSON.stringify(results, null, 2));
});
