/** A4 (ADR-0146): bulk writes, with the port's index events and its redaction. */
import { describe, expect, it, vi } from "vitest";
import { rememberBulkAccepted } from "./bulk.ts";
import type { MemoryScope } from "./client.ts";
import type { WriteEvent } from "./port.ts";

interface Call {
  items: { text: string; namespace?: string }[];
  key: string | undefined;
}

function fakeClient(opts: { fail?: number[] } = {}) {
  const calls: Call[] = [];
  const singles: string[] = [];
  const client = {
    rememberBulk: async (
      items: { text: string; namespace?: string }[],
      o?: { idempotencyKey?: string },
    ) => {
      calls.push({ items, key: o?.idempotencyKey });
      return { job_ids: items.map((_, i) => `job-${calls.length}-${i}`), total: items.length };
    },
    waitForRememberJobs: async (ids: string[]) => ({
      results: ids.map((id, i) =>
        opts.fail?.includes(i)
          ? { id, blob_id: "", status: "failed", namespace: "ns", error: "seal throttled" }
          : { id, blob_id: `blob-${id}`, status: "done", namespace: "ns" },
      ),
    }),
    remember: async (text: string) => {
      singles.push(text);
      return { job_id: `retry-${singles.length}` };
    },
    waitForRememberJob: async (id: string) => ({ blob_id: `blob-${id}` }),
  };
  return { client, calls, singles };
}

let current = fakeClient();
vi.mock("./client.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./client.ts")>()),
  createClient: () => current.client,
}));
const { createMemoryPort } = await import("./port.ts");

const scope: MemoryScope = {
  mode: "guest",
  key: "c".repeat(64),
  accountId: `0x${"3".repeat(64)}`,
  serverUrl: "https://relayer.example",
  namespace: "remora:r1:me",
};

describe("remember_bulk (A4)", () => {
  it("sends one call with the key, and retries a failed line once on its own", async () => {
    const f = fakeClient({ fail: [1] });
    const out = await rememberBulkAccepted(f.client as never, {
      texts: ["a", "b", "c"],
      namespace: "remora:r1:me",
      idempotencyKey: "import-k1",
    });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]?.key).toBe("import-k1");
    expect(f.calls[0]?.items.map((i) => i.namespace)).toEqual([
      "remora:r1:me",
      "remora:r1:me",
      "remora:r1:me",
    ]);
    const settled = await out.settled;
    expect(settled.map((s) => s.status)).toEqual(["stored", "stored", "stored"]);
    expect(settled[1]?.attempts).toBe(2);
    expect(f.singles).toEqual(["b"]);
  });

  it("refuses more than 20 lines", async () => {
    const f = fakeClient();
    await expect(
      rememberBulkAccepted(f.client as never, {
        texts: Array.from({ length: 21 }, (_, i) => `l${i}`),
        namespace: "ns",
        idempotencyKey: "k",
      }),
    ).rejects.toThrow(/at most 20/);
    expect(f.calls).toHaveLength(0);
  });

  it("the port redacts, indexes each line at accept and settle, and skips known hashes", async () => {
    current = fakeClient();
    const events: WriteEvent[] = [];
    const port = createMemoryPort({
      scope,
      by: "import",
      channel: "remora",
      onWrite: async (e) => {
        events.push(e);
        return e.outcome === "accepted" ? `idx-${events.length}` : undefined;
      },
    });
    const first = await port.rememberBulk(
      [
        { type: "profile", text: "Prefers bun over npm", channel: "remora" },
        { type: "profile", text: "key sk-abcdefghijklmnopqrstuv", channel: "remora" },
        { type: "profile", text: "Prefers bun over npm", channel: "remora" },
      ],
      { idempotencyKey: "import-k2" },
    );
    await port.flush();
    expect(first.saved).toBe(2);
    expect(first.skipped).toBe(1);
    expect(first.items[1]?.redacted).toContain("openai-style-key");
    expect(current.calls[0]?.items[1]?.text).toMatch(/\[REDACTED:openai-style-key\]/);
    expect(current.calls[0]?.items[0]?.text).toMatch(/^\[profile\] \[by:@import\] \[#remora\]/);
    expect(events.map((e) => e.outcome)).toEqual(["accepted", "accepted", "stored", "stored"]);
    expect(first.items[0]?.indexId).toBe("idx-1");

    const again = await port.rememberBulk(
      [{ type: "profile", text: "Prefers bun over npm", channel: "remora" }],
      { idempotencyKey: "import-k3", knownHashes: new Set([first.items[0]?.textSha256 ?? ""]) },
    );
    expect(again).toMatchObject({ saved: 0, skipped: 1 });
    expect(current.calls).toHaveLength(1);
  });
});
