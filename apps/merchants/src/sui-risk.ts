/**
 * E9 `sui-risk`: a paid x402 read of a Sui object or package, through Tatum gRPC. It returns the
 * last change, the age, and who can upgrade it (the `UpgradeCap` holder).
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
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
  /**
   * False when the node no longer has the last change's transaction (a public fullnode prunes old
   * history), so the age and the upgrade authority are unknown rather than absent.
   */
  historyAvailable: boolean;
  ageDays: number | null;
  upgradeCap: { id: string; owner: unknown } | null;
  /** One of Sui's own packages (std, sui, sui_system), part of the protocol. */
  systemPackage: boolean;
  flags: string[];
}

/**
 * Sui's own packages: the network upgrades them in place at epoch changes, so their last change is
 * recent on any network and says nothing about how old or trusted they are.
 */
const SYSTEM_PACKAGES = new Set(["0x1", "0x2", "0x3"].map((id) => normalizeSuiAddress(id)));

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
  let historyAvailable = true;
  // The buyer has paid by the time this runs, so a missing transaction is reported, not thrown.
  const res = digest
    ? await client.core
        .getTransaction({ digest, include: { effects: true, objectTypes: true } })
        .catch(() => null)
    : null;
  if (digest && !res) historyAvailable = false;
  if (res) {
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
  const systemPackage = SYSTEM_PACKAGES.has(normalizeSuiAddress(id));
  const ageDays = timestampMs ? Math.floor((now - timestampMs) / 86_400_000) : null;
  const flags: string[] = [];
  if (!systemPackage && ageDays !== null && ageDays < 7) flags.push("younger than 7 days");
  if (!historyAvailable)
    flags.push("history unavailable: its age and upgrade authority are unknown");
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
    systemPackage,
    historyAvailable,
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
