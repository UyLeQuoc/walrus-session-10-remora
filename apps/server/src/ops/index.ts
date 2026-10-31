/** Wires health and `diagnose` (ADR-0052) to the real env. */
import { tatumCallsLastHour } from "@remora/chain";
import { jobs, sql } from "@remora/db";
import { createClient, RelayerExtras } from "@remora/memory";
import { DEPLOYMENTS, type Deployment } from "@remora/schema";
import { db, operator } from "../context.ts";
import { env } from "../env/load.ts";
import { walrusEndpoints } from "../hatchery/walrus.ts";
import { networks } from "../money/index.ts";
import { diagnose } from "./diagnose.ts";
import { type HealthDeps, healthReport } from "./health.ts";

export { publicStatus } from "./health.ts";

const available = () =>
  networks
    .list()
    .filter((n) => n.available)
    .map((n) => n.network);

export function liveHealthDeps(playground?: HealthDeps["playground"]): HealthDeps {
  return {
    networks: available(),
    db: () => db.execute(sql`select 1`),
    async tip(network) {
      const { response } = await networks
        .client(network as "testnet")
        .ledgerService.getServiceInfo({});
      return Number(response.checkpointHeight ?? 0);
    },
    async relayerHealth() {
      const res = await fetch(`${env.MEMWAL_SERVER_URL}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error(`relayer /health answered ${res.status}`);
    },
    async facilitator(network) {
      const url = networks.config(network as "testnet").facilitatorUrl;
      if (!url) return null;
      const res = await fetch(`${url}/supported`, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new Error(`facilitator /supported answered ${res.status}`);
      const body = (await res.json()) as {
        kinds?: { network?: string; extra?: { sponsor?: string | null } }[];
      };
      const kind = body.kinds?.find((k) => k.network?.includes(network));
      return { sponsor: kind?.extra?.sponsor ?? null };
    },
    async suiBalance(network, address) {
      const b = await networks.client(network as "testnet").core.getBalance({ owner: address });
      return BigInt((b as { balance: { balance: string } }).balance.balance);
    },
    async queue() {
      const [row] = await db
        .select({
          due: sql<number>`count(*)`,
          oldest: sql<string | null>`min(${jobs.runAt})`,
        })
        .from(jobs)
        .where(sql`${jobs.status} = 'queued' and ${jobs.runAt} <= now()`);
      const oldest = row?.oldest ? Date.parse(String(row.oldest)) : null;
      return { due: Number(row?.due ?? 0), oldestDueMs: oldest ? Date.now() - oldest : null };
    },
    watcherOn: env.WATCHER === "on",
    tatumLastHour: () => tatumCallsLastHour(),
    ...(playground ? { playground } : {}),
  };
}

export const liveHealth = (playground?: HealthDeps["playground"]) =>
  healthReport(liveHealthDeps(playground));

/** `REMORA_DEPLOYMENTS_OVERRIDE` (diagnose only): JSON merged over DEPLOYMENTS, to prove the gate fails. */
export function deploymentsFor(
  network: "testnet" | "mainnet",
  override = process.env.REMORA_DEPLOYMENTS_OVERRIDE,
) {
  const base = DEPLOYMENTS[network] as Deployment;
  if (!override) return base;
  const parsed = JSON.parse(override) as Record<string, Partial<Deployment>>;
  return { ...base, ...(parsed[network] ?? {}) };
}

export async function liveDiagnose(network: "testnet" | "mainnet") {
  const dep = deploymentsFor(network);
  const core = networks.client(network).core;
  const facilitator = networks.config(network).facilitatorUrl;
  return diagnose({
    network,
    deployment: {
      remoraPackageId: dep.remoraPackageId,
      discRegistryId: dep.discRegistryId,
      hatcheryPackageId: dep.hatcheryPackageId ?? null,
      hatcheryRegistryId: dep.hatcheryRegistryId,
      memwalRelayer: dep.memwalRelayer,
    },
    async objectType(id) {
      const { object } = await core.getObject({ objectId: id });
      return object.type;
    },
    async tip() {
      const { response } = await networks.client(network).ledgerService.getServiceInfo({});
      return Number(response.checkpointHeight ?? 0);
    },
    async relayerConfig() {
      const res = await fetch(`${env.MEMWAL_SERVER_URL}/config`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`/config answered ${res.status}`);
      return (await res.json()) as { packageId?: string };
    },
    async delegates() {
      if (!operator.accountId || !operator.key) return null;
      return (await new RelayerExtras(operator).agents()).agents.length;
    },
    async recall() {
      if (!operator.accountId || !operator.key) return false;
      const namespace = "remora:diagnose:probe";
      const client = createClient({ mode: "guest", ...operator, namespace });
      await Promise.race([
        client.recall({ query: "diagnose probe", namespace, limit: 1 }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("no answer in 15000 ms")), 15_000).unref(),
        ),
      ]);
      return true;
    },
    walrus: walrusEndpoints(network),
    fetchStatus: async (url) => (await fetch(url, { signal: AbortSignal.timeout(8_000) })).status,
    ...(facilitator ? { facilitator } : {}),
  });
}
