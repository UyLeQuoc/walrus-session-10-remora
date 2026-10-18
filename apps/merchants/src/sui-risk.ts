/**
 * E9 `sui-risk`: a paid x402 read of a Sui object or package, through Tatum gRPC. It returns the
 * last change, the age, and who can upgrade it (the `UpgradeCap` holder).
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { SuiNetworkName } from "@remora/disc-sdk";
import { type PaidContext, type X402Options, x402 } from "@remora/merchant";
import { Hono } from "hono";

export interface RiskReport {
  id: string;
  network: SuiNetworkName;
  type: string;
  version: string;
  owner: unknown;
  lastChange: { digest: string | null; timestampMs: number | null };
  ageDays: number | null;
  upgradeCap: { id: string; owner: unknown } | null;
  flags: string[];
}

export async function riskOf(
  client: SuiGrpcClient,
  network: SuiNetworkName,
  id: string,
  now = Date.now(),
): Promise<RiskReport> {
  const { object } = await client.core.getObject({
    objectId: id,
    include: { previousTransaction: true },
  });
  const digest = object.previousTransaction ?? null;
  let timestampMs: number | null = null;
  let upgradeCap: RiskReport["upgradeCap"] = null;
  if (digest) {
    const res = await client.core.getTransaction({
      digest,
      include: { effects: true, objectTypes: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    timestampMs = tx.timestampMs;
    const capId = tx.effects?.changedObjects.find((o) =>
      tx.objectTypes?.[o.objectId]?.endsWith("::package::UpgradeCap"),
    )?.objectId;
    if (capId) {
      const cap = await client.core.getObject({ objectId: capId }).catch(() => null);
      upgradeCap = { id: capId, owner: cap?.object.owner ?? "deleted (immutable)" };
    }
  }
  const ageDays = timestampMs ? Math.floor((now - timestampMs) / 86_400_000) : null;
  const flags: string[] = [];
  if (ageDays !== null && ageDays < 7) flags.push("younger than 7 days");
  if (
    upgradeCap &&
    typeof upgradeCap.owner === "object" &&
    upgradeCap.owner &&
    "AddressOwner" in upgradeCap.owner
  ) {
    flags.push("upgradeable by a single address");
  }
  return {
    id,
    network,
    type: object.type,
    version: object.version,
    owner: object.owner,
    lastChange: { digest, timestampMs },
    ageDays,
    upgradeCap,
    flags,
  };
}

export function createSuiRiskApp(o: {
  pay: X402Options;
  clients: Partial<Record<SuiNetworkName, SuiGrpcClient>>;
}) {
  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  app.get("/health", (c) => c.json({ ok: true }));
  app.get("/sui-risk/:id", x402(o.pay), async (c) => {
    const paid = c.get("x402");
    const client = o.clients[paid.network];
    if (!client) return c.json({ error: { code: "network.unavailable" } }, 400);
    const id = c.req.param("id");
    if (!/^0x[0-9a-fA-F]{1,64}$/.test(id)) return c.json({ error: { code: "bad_id" } }, 400);
    return c.json({ report: await riskOf(client, paid.network, id), paid });
  });
  return app;
}
