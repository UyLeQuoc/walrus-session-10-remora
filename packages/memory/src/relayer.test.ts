import { describe, expect, it } from "vitest";
import { forgetSettled } from "./relayer.ts";

/**
 * A relayer that behaves as measured on Nov 6 (ADR-0153): a job's memory is indexed only once the
 * job settles, and forget drops only what is indexed.
 */
function fakeRelayer(opts: { settles?: boolean } = {}) {
  const running = new Map<string, string>(); // job id → namespace
  const indexed = new Map<string, number>(); // namespace → rows
  const settle = (jobId: string) => {
    const ns = running.get(jobId);
    if (!ns) return;
    running.delete(jobId);
    indexed.set(ns, (indexed.get(ns) ?? 0) + 1);
  };
  return {
    start(ns: string, ...jobIds: string[]) {
      for (const id of jobIds) running.set(id, ns);
    },
    recall: (ns: string) => indexed.get(ns) ?? 0,
    settleAll: () => {
      for (const id of [...running.keys()]) settle(id);
    },
    async forget(ns: string) {
      const deleted = indexed.get(ns) ?? 0;
      indexed.delete(ns);
      return { deleted, namespace: ns, owner: "0xowner" };
    },
    async waitForJobs(_ns: string, jobIds: readonly string[]) {
      if (opts.settles !== false) for (const id of jobIds) settle(id);
      return jobIds.filter((id) => running.has(id)).length;
    },
  };
}

describe("forgetSettled (ADR-0153)", () => {
  it("a forget before the jobs settle drops nothing, and they land after it (the A4 bug)", async () => {
    const relayer = fakeRelayer();
    relayer.start("remora:x:import-staging", "job-1", "job-2");
    expect((await relayer.forget("remora:x:import-staging")).deleted).toBe(0);
    relayer.settleAll();
    expect(relayer.recall("remora:x:import-staging")).toBe(2);
  });

  it("waits for the namespace's jobs, then forgets what they wrote", async () => {
    const relayer = fakeRelayer();
    relayer.start("remora:x:import-staging", "job-1", "job-2");
    const out = await forgetSettled(relayer, "remora:x:import-staging", ["job-1", "job-2"]);
    expect(out).toMatchObject({ deleted: 2, pending: 0 });
    expect(relayer.recall("remora:x:import-staging")).toBe(0);
  });

  it("says how many jobs were still running when the wait gave up", async () => {
    const relayer = fakeRelayer({ settles: false });
    relayer.start("remora:x:me", "job-1");
    expect(await forgetSettled(relayer, "remora:x:me", ["job-1"])).toMatchObject({
      deleted: 0,
      pending: 1,
    });
  });

  it("forgets at once when nothing is running, and a failed wait counts every job as pending", async () => {
    const relayer = fakeRelayer();
    expect(await forgetSettled(relayer, "remora:x:me", [])).toMatchObject({ pending: 0 });
    const broken = {
      ...relayer,
      waitForJobs: async () => {
        throw new Error("relayer 503");
      },
    };
    expect(await forgetSettled(broken, "remora:x:me", ["a", "b"])).toMatchObject({ pending: 2 });
  });
});
