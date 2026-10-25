/**
 * An in-memory `/mcp` for tests and the attack evals: the real routes, tools, RPC core and Sonar
 * policy, with a fake remora, Reef, memory and database. No chain, no relayer, no Postgres.
 */
import { createLogger } from "@remora/chain";
import type { Db } from "@remora/db";
import type { RemoraConfig } from "@remora/schema";
import type { ResolvedReef } from "../money/reef.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { SlidingLimiter } from "../runtime/limits.ts";
import type { Remora } from "../runtime/remoras.ts";
import { policyCheck } from "../runtime/sonar.ts";
import type { PayOutcome, requestPayment } from "../tools/pay.ts";
import { createMcpRoutes } from "./routes.ts";
import type { CallRecord, TokenRow } from "./tokens.ts";
import { createMcpTools } from "./tools.ts";

export const PAYTO = `0x${"3e".repeat(32)}`;
export const USDC = `0x${"a1".repeat(32)}::usdc::USDC`;
export const SCOUT_ID = "0b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a10";
export const SENTINEL_ID = "1c7a3e5f-9b62-4d4f-8a2b-3e8d6c9f0b21";
export const ORIGIN = "http://localhost:5183";
/** The Disc's onchain per-payment cap in the fake chain: sui-risk (0.01) fits, odds (0.02) doesn't. */
export const DISC_CAP = 15_000n;

export const REEF: ResolvedReef[] = [
  ["sui-risk", "/sui-risk/:id", "10000"],
  ["odds", "/odds", "20000"],
  ["brief", "/brief", "10000"],
].map(([slug, path, price]) => ({
  ref: `reef:${slug}` as const,
  slug: slug as string,
  name: slug as string,
  description: `${slug} service`,
  path: path as string,
  price: price as string,
  url: `http://merchant.test${path}`,
  payTo: PAYTO,
}));

export function remoraRow(template: "scout" | "sentinel"): Remora {
  return {
    id: template === "scout" ? SCOUT_ID : SENTINEL_ID,
    ownerAddress: `0x${"0f".repeat(32)}`,
    network: "testnet",
    template,
    name: template === "scout" ? "Scout" : "Sentinel",
    config: {},
    status: "active",
    address: `0x${"5c".repeat(32)}`,
    discName: "d",
    discId: `0x${"d1".repeat(32)}`,
    allowanceId: `0x${"a1".repeat(32)}`,
    capId: null,
    shadowUntil: null,
    playground: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Remora;
}

const config = (r: Remora) =>
  ({
    namespaces:
      r.template === "scout"
        ? ["me", "sources", "feedback", "budget", "handoffs", "receipts"]
        : ["me", "rules", "episodes", "receipts"],
    budget: {
      coinType: USDC,
      windowLimit: "500000",
      window: "month",
      perPaymentCap: DISC_CAP.toString(),
      expiresAt: "2026-12-31T23:59:59Z",
      payees: REEF.map((e) => e.ref),
    },
  }) as unknown as RemoraConfig;

export function tokenRow(scopes: string[], over: Partial<TokenRow> = {}): TokenRow {
  return {
    id: "6f1d2c3b-4a5e-4f60-8a71-92b3c4d5e6f7",
    remoraId: SCOUT_ID,
    ownerAddress: `0x${"0f".repeat(32)}`,
    name: "Claude Code",
    client: "claude-code",
    scopes,
    prefix: "rmcp_test",
    secretSha256: "0".repeat(64),
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    lastUsedAt: null,
    revokedAt: null,
    ...over,
  };
}

/** The Disc's live policy, as `requestPayment` reads it, and Sonar's deterministic check on it. */
export const fakePay = (async (_rt, _r, p): Promise<PayOutcome> => {
  const entry = REEF.find((e) => e.ref === p.payee);
  const v = policyCheck(
    {
      payee: p.payee,
      payTo: entry?.payTo ?? "0x0",
      amount: BigInt(entry?.price ?? "0"),
      reason: p.reason,
    },
    {
      status: "active",
      discPayees: [PAYTO],
      perPaymentCap: DISC_CAP,
      paused: false,
      softLimit: DISC_CAP,
      reef: REEF,
    },
  );
  if (v.verdict === "allow")
    return {
      kind: "paid",
      response: new Response('{"risk":"low"}'),
      digest: "FakeDigest1111111111111111111111111",
      amount: entry?.price ?? "0",
      receiptId: "4c5d6e7f-8a9b-4c0d-9e1f-2a3b4c5d6e7f",
      eventId: "",
    };
  return {
    kind: "blocked",
    code: v.verdict === "ask" && p.onAsk === "refuse" ? "over_limit" : "sonar.blocked",
    reasons: v.reasons,
    eventId: "",
    receiptId: null,
  };
}) as typeof requestPayment;

export interface Harness {
  app: ReturnType<typeof createMcpRoutes>;
  calls: CallRecord[];
  inserts: { table: string; values: Record<string, unknown> }[];
  remembered: { ns: string; type: string; text: string; by?: string }[];
  call(
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<{ status: number; json: Record<string, unknown> | null }>;
}

export function harness(opts: {
  token: TokenRow;
  auth?: "revoked" | "expired";
  template?: "scout" | "sentinel";
  /** What the service's 402 says (approval_request reads it). */
  payTo?: string;
}): Harness {
  const calls: CallRecord[] = [];
  const inserts: Harness["inserts"] = [];
  const remembered: Harness["remembered"] = [];
  const r = remoraRow(opts.template ?? "scout");
  const db = {
    insert: (table: { [k: symbol]: unknown }) => ({
      values: (values: Record<string, unknown>) => {
        const name = String(
          (table as unknown as Record<symbol, string>)[Symbol.for("drizzle:Name")] ?? "table",
        );
        inserts.push({ table: name, values });
        const p = Promise.resolve();
        return Object.assign(p, {
          returning: async () => [{ id: "a9b8c7d6-e5f4-4a3b-9c2d-1e0f2a3b4c5d" }],
        });
      },
    }),
  } as unknown as Db;
  const log = createLogger({}, () => {});
  const rt = {
    db,
    log,
    reef: () => REEF,
    networks: { config: () => ({ usdcCoinType: USDC }) },
    memory: {
      recall: async () => [],
      remember: async (
        _r: unknown,
        ns: string,
        type: string,
        text: string,
        o?: { by?: string },
      ) => {
        remembered.push({ ns, type, text, ...(o?.by ? { by: o.by } : {}) });
        return { saved: true, note: "", indexId: "7e8f9a0b-1c2d-4e3f-8a4b-5c6d7e8f9a0b" };
      },
    },
    notifier: { send: async () => {} },
    limiter: new SlidingLimiter(),
    webBase: ORIGIN,
    fetch: (async () =>
      Response.json(
        {
          x402Version: 1,
          accepts: [
            {
              scheme: "exact",
              network: "sui:testnet",
              asset: USDC,
              payTo: opts.payTo ?? PAYTO,
              amount: "20000",
              maxAmountRequired: "20000",
            },
          ],
        },
        { status: 402 },
      )) as typeof fetch,
  } as unknown as RuntimeDeps;
  const app = createMcpRoutes({
    db,
    log,
    limiter: rt.limiter,
    tools: createMcpTools({ rt, config, pay: fakePay }),
    owner: async () => null,
    network: () => "testnet",
    remoraFor: async () => r,
    remoraById: async () => r,
    apiBase: () => "http://localhost:8797",
    stdioBin: "/repo/packages/mcp/src/bin.ts",
    allowedOrigins: [ORIGIN],
    authenticate: async (secret) =>
      !secret
        ? { ok: false, reason: "missing" }
        : opts.auth
          ? { ok: false, reason: opts.auth }
          : { ok: true, token: opts.token },
    record: async (_id, c) => {
      calls.push(c);
    },
  });
  return {
    app,
    calls,
    inserts,
    remembered,
    async call(body, headers = {}) {
      const res = await app.request("/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer rmcp_test",
          ...headers,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      return {
        status: res.status,
        json: text ? (JSON.parse(text) as Record<string, unknown>) : null,
      };
    },
  };
}
