/**
 * G1: a Wake for every action, not only payments (spec §9). Non-payment Wakes aren't anchored onchain
 * in the MVP; payment Wakes come from `payWithDisc`. Each one is also written to the remora's
 * `receipts` namespace in the background, so the owner holds it.
 */
import { createHash } from "node:crypto";
import type { Logger } from "@remora/chain";
import { type Db, receipts } from "@remora/db";
import { type Decision, intentHash, Wake, type WakeIntent } from "@remora/schema";
import type { Recalled, RemoraMemory } from "./memory.ts";

export const sha256Hex = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

export interface WakeRemora {
  id: string;
  name: string;
  ownerAddress: string;
  network: "testnet" | "mainnet";
  address: string;
}

/** The trusted part of an intent, before a decision is attached. */
export function intentBase(input: {
  trigger: { kind: "message" | "cron" | "chain" | "price" | "webhook" | "handoff"; ref: string };
  trustedInput: string;
  memories: Recalled[];
  model: string;
  prompt: string;
  checkpoint?: number;
}): Omit<WakeIntent, "decision" | "sonar"> {
  return {
    trigger: input.trigger,
    inputs: {
      via: "tatum",
      ...(input.checkpoint ? { checkpoint: input.checkpoint } : {}),
      objects: [],
      sha256: sha256Hex(input.trustedInput),
    },
    memories: input.memories
      .filter((m) => /^[A-Za-z0-9_-]{8,}$/.test(m.blobId))
      .map((m) => ({ blobId: m.blobId, namespace: m.namespace, distance: m.distance })),
    model: { id: input.model, promptSha256: sha256Hex(input.prompt) },
  };
}

export async function recordWake(
  deps: { db: Db; memory?: RemoraMemory; log: Logger },
  r: WakeRemora,
  intent: Omit<WakeIntent, "decision" | "sonar">,
  decision: Decision,
  sonarVerdict: { verdict: "allow" | "block" | "ask"; reasons: string[] },
  result: { tx?: string; responseSha256?: string; error?: string },
) {
  const full: WakeIntent = { ...intent, decision, sonar: sonarVerdict };
  const wake = Wake.parse({
    v: 1,
    remora: r.id,
    agent: r.address,
    ts: new Date().toISOString(),
    intent: full,
    result,
  });
  const [row] = await deps.db
    .insert(receipts)
    .values({
      network: r.network,
      remoraId: r.id,
      agent: r.address,
      wake: wake as unknown as Record<string, unknown>,
      intentHash: intentHash(full),
      txDigest: result.tx ?? null,
    })
    .returning();
  if (deps.memory) {
    void deps.memory
      .remember(r, "receipts", "wake", JSON.stringify(wake))
      .catch((err) => deps.log.warn("wake.memory_failed", { remora: r.id, error: err }));
  }
  return row;
}
