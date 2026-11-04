import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "./deps.ts";
import {
  balanceLines,
  balances,
  type Expense,
  parseSplit,
  payLinkOf,
  splitAsk,
  splitsOf,
} from "./splitter.ts";

const e = (payer: string, amount: string, among: string[], memo = "x"): Expense => ({
  at: "2026-11-05T00:00:00Z",
  payer,
  amount,
  memo,
  among,
});

describe("Splitter (B3)", () => {
  it("reads who paid, how much, for what and for whom", () => {
    expect(parseSplit("I paid 12 for dinner for Linh, Huy and me")).toEqual({
      payer: "me",
      amount: "12000000",
      memo: "dinner",
      among: ["Linh", "Huy", "me"],
    });
    expect(parseSplit("Linh paid 9 for taxi for me and Huy")).toEqual({
      payer: "Linh",
      amount: "9000000",
      memo: "taxi",
      among: ["me", "Huy"],
    });
    expect(parseSplit("split 30.5 for groceries with Linh")).toEqual({
      payer: "me",
      amount: "30500000",
      memo: "groceries",
      among: ["me", "Linh"],
    });
    expect(parseSplit("pay Linh 2 USDC")).toBeNull();
  });

  it("splits evenly, rounding down to the smallest unit, and keeps only debts with the owner", () => {
    // 10 USDC three ways: 3.333333 each; the payer keeps the 0.000001 left over.
    const b = balances([
      e("me", "10000000", ["me", "Linh", "Huy"]),
      e("Linh", "9000000", ["me", "Huy"]),
    ]);
    expect(b.get("Linh")).toBe(3_333_333n - 4_500_000n);
    expect(b.get("Huy")).toBe(3_333_333n);
    // Uneven: Huy wasn't in the taxi with the owner, so Huy owes Linh, which isn't tracked here.
    expect(balanceLines({ expenses: [e("Linh", "9000000", ["me", "Huy"])], links: [] })).toEqual([
      "You owe Linh 4.50 USDC",
    ]);
    expect(balanceLines({ expenses: [], links: [] })).toEqual(["Everyone is even."]);
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("Splitter in Postgres (B3)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0e8${process.pid.toString(16)}`);
  const deps = {
    db,
    log: createLogger({}, () => {}),
    webBase: "http://web.test",
  } as unknown as RuntimeDeps;
  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("keeps a running balance, and settling up makes a pay link for each person who owes", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "errand",
        name: "Errand",
        config: {},
        status: "active",
        address: OWNER,
      })
      .returning();
    if (!r) throw new Error("no remora");
    expect((await splitAsk(deps, r, "I paid 12 for dinner for Linh, Huy and me"))?.lines).toEqual([
      "Noted 12.00 USDC for dinner.",
      "Linh owes you 4.00 USDC",
      "Huy owes you 4.00 USDC",
    ]);
    const [now] = await db.select().from(remoras).where(eq(remoras.id, r.id));
    const settled = await splitAsk(deps, now as typeof r, "settle up");
    expect(settled?.lines[0]).toMatch(
      /^Linh owes you 4\.00 USDC: http:\/\/web\.test\/pay\/[\w-]{16}$/,
    );
    const token = settled?.lines[0]?.split("/pay/")[1] ?? "";
    const found = await payLinkOf(deps, token);
    expect(found?.link).toMatchObject({
      name: "Linh",
      amount: "4000000",
      memo: "settle up: dinner",
    });
    const [after] = await db.select().from(remoras).where(eq(remoras.id, r.id));
    expect(balanceLines(splitsOf(after as typeof r))).toEqual(["Everyone is even."]);
    expect(await payLinkOf(deps, "not-a-token-at-all")).toBeNull();
  });
});
