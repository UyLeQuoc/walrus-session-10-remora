/**
 * K2 (ADR-0052): `diagnose`, the deploy gate. It checks that every `DEPLOYMENTS` id exists onchain
 * with the Move type the code expects, that Tatum, the relayer, Walrus and the facilitator answer,
 * and says how to fix whatever doesn't. `ok` is false when any item is down.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { DiagnoseReport, HealthItem } from "@remora/schema";

export interface DiagnoseDeps {
  network: "testnet" | "mainnet";
  deployment: {
    remoraPackageId: string | null;
    discRegistryId: string | null;
    hatcheryPackageId: string | null;
    hatcheryRegistryId: string | null;
    /** ADR-0130: memory capsules; checked once published. */
    capsulePackageId?: string | null;
    memwalRelayer: string;
  };
  /** The object's Move type (`package` for a package); throws when it doesn't exist. */
  objectType: (id: string) => Promise<string>;
  tip: () => Promise<number>;
  /** `GET <relayer>/config`. */
  relayerConfig: () => Promise<{ packageId?: string }>;
  /** Delegates the relayer lists for the operator account (null when not configured). */
  delegates?: () => Promise<number | null>;
  /**
   * One recall in a probe namespace: proves the relayer can embed and search, which `/health` and
   * `/config` don't (ADR-0055). Resolves false when no operator account is configured.
   */
  recall?: () => Promise<boolean>;
  /**
   * A0 (ADR-0135): the last 7 days of stored writes we recorded, against the SDK's `listMemories()`.
   * Null when no operator account is configured.
   */
  memoryIndex?: () => Promise<{ written: number; listed: number; missing: string[] } | null>;
  walrus: { publisher: string | null; aggregator: string };
  fetchStatus: (url: string) => Promise<number>;
  facilitator?: string | null;
  now?: () => Date;
}

const ok = (name: string, detail: string): HealthItem => ({
  name,
  status: "ok",
  detail,
  value: null,
  threshold: null,
  fix: null,
});
const down = (name: string, detail: string, fix: string): HealthItem => ({
  name,
  status: "down",
  detail,
  value: null,
  threshold: null,
  fix,
});
const short = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;

/**
 * What a failed Tatum call means, when it's Tatum and not the object: a 402 is a key out of
 * credits (both keys answered 402 on Oct 23), a 401/403 a refused key, a 429 the rate limit.
 * Null for anything else, such as an object that doesn't exist.
 */
export function tatumTrouble(message: string, network: string): string | null {
  const key = network === "mainnet" ? "TATUM_API_KEY" : "TATUM_API_KEY_TESTNET";
  if (/\b402\b/.test(message))
    return `Tatum answered 402: the key is out of credits. Top up its plan, or set a new ${key}.`;
  if (/\b(401|403)\b|UNAUTHENTICATED|PERMISSION_DENIED/.test(message))
    return `Tatum refused the key: check ${key}.`;
  if (/\b429\b|RESOURCE_EXHAUSTED/.test(message))
    return "Tatum is rate-limiting this key: slow the callers or raise the plan.";
  if (/HTTP status code \d+|UNAVAILABLE|DEADLINE_EXCEEDED/.test(message))
    return `Tatum didn't answer: check the gRPC URL for ${network} and Tatum's status.`;
  return null;
}
const sameType = (a: string, b: string) =>
  a.replace(/0x[0-9a-fA-F]+/g, (x) => normalizeSuiAddress(x)) ===
  b.replace(/0x[0-9a-fA-F]+/g, (x) => normalizeSuiAddress(x));

export async function diagnose(d: DiagnoseDeps): Promise<DiagnoseReport> {
  const items: HealthItem[] = [];
  const where = `DEPLOYMENTS.${d.network}`;

  const expect = async (name: string, id: string | null, field: string, want: string | null) => {
    if (!id) {
      items.push(down(name, "not set", `Publish it on ${d.network} and set ${where}.${field}.`));
      return;
    }
    try {
      const type = await d.objectType(id);
      if (want === null ? type !== "package" : !sameType(type, want))
        items.push(
          down(
            name,
            `${short(id)} is ${type}, not ${want ?? "a package"}`,
            `Set ${where}.${field} to the ${want ?? "package"} from the publish.`,
          ),
        );
      else
        items.push(
          ok(
            name,
            `${short(id)} is ${want === null ? "a package" : want.split("::").slice(1).join("::")}`,
          ),
        );
    } catch (err) {
      const message = (err as Error).message;
      const trouble = tatumTrouble(message, d.network);
      items.push(
        trouble
          ? down(name, `couldn't check ${short(id)}: ${message.slice(0, 80)}`, trouble)
          : down(
              name,
              `${short(id)} doesn't exist on ${d.network} (${message.slice(0, 80)})`,
              `Set ${where}.${field} to an id from the ${d.network} publish.`,
            ),
      );
    }
  };
  const dep = d.deployment;
  await expect("remora package", dep.remoraPackageId, "remoraPackageId", null);
  await expect(
    "disc registry",
    dep.discRegistryId,
    "discRegistryId",
    dep.remoraPackageId ? `${dep.remoraPackageId}::disc::Registry` : "::disc::Registry",
  );
  await expect("hatchery package", dep.hatcheryPackageId, "hatcheryPackageId", null);
  await expect(
    "hatchery registry",
    dep.hatcheryRegistryId,
    "hatcheryRegistryId",
    dep.hatcheryPackageId ? `${dep.hatcheryPackageId}::hatchery::Registry` : "::hatchery::Registry",
  );
  if (dep.capsulePackageId)
    await expect("capsule package", dep.capsulePackageId, "capsulePackageId", null);

  try {
    const tip = await d.tip();
    items.push(ok("tatum", `latest checkpoint ${tip}`));
  } catch (err) {
    items.push(
      down(
        "tatum",
        (err as Error).message.slice(0, 120),
        tatumTrouble((err as Error).message, d.network) ??
          `Check the Tatum key and gRPC URL for ${d.network}.`,
      ),
    );
  }

  try {
    const config = await d.relayerConfig();
    items.push(
      config.packageId
        ? ok("relayer /config", `package ${short(config.packageId)}`)
        : down(
            "relayer /config",
            "no packageId",
            "Check MEMWAL_SERVER_URL; the relayer's /config should name its package.",
          ),
    );
  } catch (err) {
    items.push(
      down(
        "relayer /config",
        (err as Error).message.slice(0, 120),
        "Check MEMWAL_SERVER_URL and the relayer's status.",
      ),
    );
  }
  if (d.delegates) {
    try {
      const n = await d.delegates();
      if (n !== null)
        items.push(
          n > 0
            ? ok("memory delegates", `the relayer lists ${n} delegate(s) for the operator account`)
            : down(
                "memory delegates",
                "no delegates",
                "Register the server's delegate key on the operator account (bun run diagnose:memory).",
              ),
        );
    } catch (err) {
      // The relayer's /agents route is flaky (docs/issues/07): a warning, not a gate.
      items.push({
        ...ok("memory delegates", ""),
        status: "degraded",
        detail: (err as Error).message.slice(0, 120),
        fix: "Run bun run diagnose:memory for the full check.",
      });
    }
  }

  if (d.memoryIndex) {
    try {
      const idx = await d.memoryIndex();
      if (idx)
        items.push(
          idx.missing.length
            ? {
                ...ok("memory index", ""),
                status: "degraded",
                detail: `written ${idx.written} · on Walrus Memory ${idx.listed} · missing ${idx.missing.length} (${idx.missing.slice(0, 3).join(", ")})`,
                fix: "Writes from the last minute are still settling; a gap that stays means the relayer lost them. Nothing is re-written.",
              }
            : ok(
                "memory index",
                `written ${idx.written} · on Walrus Memory ${idx.listed} · missing 0 (last 7 days)`,
              ),
        );
    } catch (err) {
      items.push({
        ...ok("memory index", ""),
        status: "degraded",
        detail: (err as Error).message.slice(0, 160),
        fix: "listMemories() failed; run bun run diagnose:memory.",
      });
    }
  }

  if (d.recall) {
    try {
      if (await d.recall()) items.push(ok("memory recall", "the relayer embeds and searches"));
    } catch (err) {
      const detail = (err as Error).message.slice(0, 160);
      // A 401/403 from the relayer is our key; anything else is the relayer's own pipeline.
      items.push(
        /server error \((401|403)\)/.test(detail)
          ? down(
              "memory recall",
              detail,
              "Check MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID (bun run diagnose:memory).",
            )
          : {
              ...ok("memory recall", ""),
              status: "degraded",
              detail,
              fix: "Memory is failing on the relayer's side; replies go on without it. Send the traceId to the MemWal team.",
            },
      );
    }
  }

  for (const [name, base] of [
    ["walrus aggregator", d.walrus.aggregator],
    ["walrus publisher", d.walrus.publisher],
  ] as const) {
    if (!base) {
      items.push({
        ...ok(name, "not configured on this network"),
        status: "degraded",
        fix: "Set a publisher that pays WAL (mainnet pass).",
      });
      continue;
    }
    const status = await d.fetchStatus(`${base}/v1/api`).catch(() => 0);
    items.push(
      status === 200
        ? ok(name, `${base} answers`)
        : down(
            name,
            `${base} answered ${status || "nothing"}`,
            `Check ${name} or its env override.`,
          ),
    );
  }

  if (d.facilitator) {
    const status = await d.fetchStatus(`${d.facilitator}/supported`).catch(() => 0);
    items.push(
      status === 200
        ? ok("facilitator", `${d.facilitator} answers /supported`)
        : down(
            "facilitator",
            `${d.facilitator} answered ${status || "nothing"}`,
            "Start the facilitator or fix FACILITATOR_URL.",
          ),
    );
  }

  const worst = items.some((i) => i.status === "down")
    ? "down"
    : items.some((i) => i.status === "degraded")
      ? "degraded"
      : "ok";
  return {
    status: worst,
    network: d.network,
    ok: worst !== "down",
    items,
    errors: [],
    checkedAt: (d.now?.() ?? new Date()).toISOString(),
  };
}
