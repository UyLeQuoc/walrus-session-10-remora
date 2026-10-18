import { describe, expect, it } from "vitest";
import { GasCoinPool } from "./gas-pool.ts";

const coin = (id: string, balance = "100") => ({
  objectId: id,
  version: "1",
  digest: "d",
  balance,
});

describe("gas coin pool (D8)", () => {
  it("gives each transaction its own coin, skips small ones, and frees on release or expiry", async () => {
    let t = 0;
    const pool = new GasCoinPool({
      list: async () => [coin("a"), coin("small", "5"), coin("b")],
      minBalance: 50n,
      holdMs: 1_000,
      waitMs: 0,
      now: () => t,
      sleep: async () => {},
    });
    expect((await pool.take()).objectId).toBe("a");
    expect((await pool.take()).objectId).toBe("b");
    await expect(pool.take()).rejects.toMatchObject({ code: "sponsor.busy" });
    pool.release(["a"]);
    expect((await pool.take()).objectId).toBe("a");
    t = 2_000; // both holds expired
    expect((await pool.take()).objectId).toBe("a");
    expect(pool.held).toBe(1);
  });

  it("waits for a coin to come back before refusing", async () => {
    let t = 0;
    let calls = 0;
    const pool = new GasCoinPool({
      list: async () => [coin("a")],
      minBalance: 1n,
      waitMs: 5_000,
      now: () => t,
      sleep: async (ms) => {
        t += ms;
        if (++calls === 2) pool.release(["a"]);
      },
    });
    await pool.take();
    expect((await pool.take()).objectId).toBe("a");
    expect(calls).toBe(2);
  });
});
