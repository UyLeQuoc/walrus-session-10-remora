/**
 * MemoryPort is what the agent core talks to. It hides guest vs owned,
 * namespaces, dedupe, rate limiting and text formatting, so channel adapters
 * and the LLM loop never touch MemWal directly.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { BULK_MAX, rememberBulkAccepted } from "./bulk.ts";
import { createClient, type MemoryScope } from "./client.ts";
import { buildMemoryText, type MemoryType, replacesBlobId } from "./format.ts";
import { limiterFor } from "./limiter.ts";
import { type RecalledMemory, recallRelevant, rememberWithDedupe } from "./policy.ts";
import { redactCredentials } from "./redact.ts";

export interface RememberInput {
  type: MemoryType;
  text: string;
  channel?: string;
  knownHashes?: ReadonlySet<string>;
  replaces?: string;
  /**
   * This write only: `false` skips the semantic duplicate check whatever the port's default. For a
   * structured record whose next version differs from the last only in its numbers (ADR-0063,
   * ADR-0074): within the duplicate distance, but a new fact.
   */
  dedupe?: boolean;
}

/** What the LLM sees. Deliberately small and free of internal ids. */
export interface RememberResult extends Record<string, unknown> {
  saved: boolean;
  note: string;
  redacted: string[];
  indexId?: string;
  blobId?: string;
}

export interface RecallInput {
  query: string;
  limit?: number;
  maxDistance?: number;
}

/** A4 (ADR-0146): one line of a bulk write. */
export interface RememberBulkItem {
  type: MemoryType;
  text: string;
  channel?: string;
}

export interface RememberBulkResult {
  saved: number;
  /** Lines already in the index (same formatted text, same hash): nothing written. */
  skipped: number;
  items: { saved: boolean; textSha256: string; indexId?: string; redacted: string[] }[];
}

export interface MemoryPort {
  readonly scope: MemoryScope;
  remember(input: RememberInput): Promise<RememberResult>;
  /**
   * Up to 20 lines in one `remember_bulk` call with the caller's idempotency key. No semantic
   * dedupe: a line whose hash is in `knownHashes` (or repeats in the batch) is skipped. Each line is
   * redacted and indexed through `onWrite` like `remember`.
   */
  rememberBulk(
    items: RememberBulkItem[],
    opts: { idempotencyKey: string; knownHashes?: ReadonlySet<string> },
  ): Promise<RememberBulkResult>;
  recall(input: RecallInput): Promise<RecalledMemory[]>;
  /** Resolves once every background write started by this port has settled. */
  flush(): Promise<void>;
}

export interface WriteEvent {
  scope: MemoryScope;
  type: MemoryType;
  /** Present once the blob exists, or for a duplicate (the blob it matched). */
  blobId: string | null;
  jobId: string | null;
  textSha256: string;
  channel: string;
  /**
   * `accepted` fires immediately and should be persisted straight away: a
   * deploy during the ~25 s write window must not lose a memory the user was
   * already told about. `stored` or `failed` follows for the same job id.
   */
  outcome: "accepted" | "stored" | "failed" | "duplicate";
  error?: string;
}

export interface CreatePortOptions {
  scope: MemoryScope;
  /** Handle written into the [by:@handle] tag. */
  by: string;
  channel: string;
  onWrite?: (e: WriteEvent) => undefined | Promise<string | undefined>;
  /**
   * Extra scopes to read from and never write to.
   *
   * This is what stops `/connect` erasing someone. Guest memories live in
   * hippo's own account under `hippo-guest:<personId>`; taking ownership moves
   * writes to the user's own account under `hippo`, a different account and a
   * different namespace. Without reading the old scope too, the moment a person
   * takes ownership of their memory is the moment it all disappears.
   */
  alsoRead?: MemoryScope[];
  /**
   * Blob ids the person asked hippo to stop using. Nothing on Walrus can be
   * deleted or edited, so hiding is ours: these never come back from recall,
   * and never count as a duplicate either — otherwise restating a hidden fact
   * would be answered "already known" and stored nowhere hippo can see.
   */
  hidden?: ReadonlySet<string>;
  /** `false` writes without the semantic duplicate check (structured records, ADR-0063). */
  dedupe?: boolean;
}

export function createMemoryPort({
  scope,
  by,
  channel,
  onWrite,
  alsoRead = [],
  hidden = new Set(),
  dedupe = true,
}: CreatePortOptions): MemoryPort {
  const client = createClient(scope);
  const limiter = limiterFor(scope.key);
  const pending = new Set<Promise<unknown>>();
  /** Read-only companions, each with its own client and its own key's limiter. */
  const secondary = alsoRead.map((s) => ({
    scope: s,
    client: createClient(s),
    limiter: limiterFor(s.key),
  }));

  const track = (p: Promise<unknown>) => {
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };

  return {
    scope,

    async remember(input) {
      const { text, removed } = redactCredentials(input.text);
      const line = buildMemoryText({
        type: input.type,
        by,
        channel: input.channel,
        text,
        replaces: replacesBlobId(input.replaces) ?? undefined,
      });
      const sha = bytesToHex(sha256(new TextEncoder().encode(line)));
      if (input.knownHashes?.has(sha)) {
        return {
          saved: false,
          note: "Already in memory, nothing written. Do not tell the user it was saved again.",
          redacted: removed,
        };
      }
      const outcome = await rememberWithDedupe(client, {
        text: line,
        namespace: scope.namespace,
        limiter,
        ignore: hidden,
        dedupe: input.dedupe ?? dedupe,
      });

      if (outcome.status === "duplicate") {
        await onWrite?.({
          scope,
          type: input.type,
          blobId: outcome.blobId,
          jobId: null,
          textSha256: sha,
          channel,
          outcome: "duplicate",
        });
        return {
          saved: false,
          note: "Already in memory, nothing written. Do not tell the user it was saved again.",
          redacted: removed,
          ...(outcome.blobId ? { blobId: outcome.blobId } : {}),
        };
      }

      // Record the accepted job now, so the memory survives a restart or deploy
      // during the write window rather than vanishing after the user was told
      // it was saved.
      const indexId = await onWrite?.({
        scope,
        type: input.type,
        blobId: null,
        jobId: outcome.jobId,
        textSha256: sha,
        channel,
        outcome: "accepted",
      });

      // The blob id arrives ~25 s later; fill it in then.
      track(
        outcome.settled.then(async (s) => {
          if (s.status !== "stored" || !s.blobId) {
            console.error(
              `[memory] write failed in ${scope.namespace}: ${s.error ?? "no blob id"}`,
            );
          }
          await onWrite?.({
            scope,
            type: input.type,
            blobId: s.blobId,
            jobId: outcome.jobId,
            textSha256: sha,
            channel,
            outcome: s.status,
            error: s.error,
          });
        }),
      );

      return {
        saved: true,
        note: `Stored as ${input.type}. It is being written to Walrus now and is recallable within about a minute.`,
        redacted: removed,
        ...(typeof indexId === "string" ? { indexId } : {}),
      };
    },

    async rememberBulk(items, opts) {
      if (items.length > BULK_MAX)
        throw new Error(`rememberBulk takes at most ${BULK_MAX} lines a call`);
      const seen = new Set(opts.knownHashes ?? []);
      const prepared = items.map((item) => {
        const { text, removed } = redactCredentials(item.text);
        const line = buildMemoryText({ type: item.type, by, channel: item.channel, text });
        const sha = bytesToHex(sha256(new TextEncoder().encode(line)));
        const fresh = !seen.has(sha);
        seen.add(sha);
        return { type: item.type, line, sha, removed, fresh };
      });
      const fresh = prepared.filter((p) => p.fresh);
      const indexIds = new Map<string, string>();
      if (fresh.length) {
        const { jobIds, settled } = await rememberBulkAccepted(client, {
          texts: fresh.map((p) => p.line),
          namespace: scope.namespace,
          idempotencyKey: opts.idempotencyKey,
          limiter,
        });
        // Recorded at accept time, as `remember` does: a deploy in the write window loses nothing.
        for (const [i, p] of fresh.entries()) {
          const indexId = await onWrite?.({
            scope,
            type: p.type,
            blobId: null,
            jobId: jobIds[i] ?? null,
            textSha256: p.sha,
            channel,
            outcome: "accepted",
          });
          if (typeof indexId === "string") indexIds.set(p.sha, indexId);
        }
        track(
          settled.then(async (list) => {
            for (const [i, p] of fresh.entries()) {
              const s = list[i];
              if (s?.status !== "stored" || !s.blobId)
                console.error(
                  `[memory] bulk write failed in ${scope.namespace}: ${s?.error ?? "no blob id"}`,
                );
              await onWrite?.({
                scope,
                type: p.type,
                blobId: s?.blobId ?? null,
                jobId: jobIds[i] ?? null,
                textSha256: p.sha,
                channel,
                outcome: s?.status ?? "failed",
                ...(s?.error ? { error: s.error } : {}),
              });
            }
          }),
        );
      }
      return {
        saved: fresh.length,
        skipped: prepared.length - fresh.length,
        items: prepared.map((p) => {
          const indexId = p.fresh ? indexIds.get(p.sha) : undefined;
          return {
            saved: p.fresh,
            textSha256: p.sha,
            redacted: p.removed,
            ...(indexId ? { indexId } : {}),
          };
        }),
      };
    },

    async recall(input) {
      const visible = (list: RecalledMemory[]) => list.filter((m) => !hidden.has(m.blob_id));
      const primary = visible(
        await recallRelevant(client, {
          ...input,
          namespace: scope.namespace,
          limiter,
        }),
      );
      if (!secondary.length) return primary;

      /**
       * Sequential, deliberately. Concurrent recalls make the relayer answer
       * with an empty result and a non-zero `dropped_count` (docs/SPIKES.md
       * §H), which is why the agent stopped issuing its own in parallel. Doing
       * it here in parallel would reintroduce exactly that.
       */
      const seen = new Map(primary.map((m) => [m.blob_id, m]));
      for (const extra of secondary) {
        try {
          const more = await recallRelevant(extra.client, {
            ...input,
            namespace: extra.scope.namespace,
            limiter: extra.limiter,
          });
          for (const m of visible(more)) if (!seen.has(m.blob_id)) seen.set(m.blob_id, m);
        } catch (err) {
          // Old memories are a bonus; failing to reach them must never cost the
          // user the ones in the account they actually own.
          console.warn("[memory] secondary recall failed", err);
        }
      }
      const merged = [...seen.values()].sort((a, b) => a.distance - b.distance);
      // Only truncate when the caller asked for a size. Defaulting to the
      // primary's length silently discarded every older memory whenever the
      // owned account happened to return fewer, which is the exact failure
      // this whole path exists to prevent.
      return input.limit ? merged.slice(0, input.limit) : merged;
    },

    async flush() {
      await Promise.allSettled([...pending]);
    },
  };
}
