import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { and, createDb, eq, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { payContact } from "../runtime/errand.ts";
import {
  canonicalName,
  isSuiName,
  type NameCore,
  nameMoved,
  nameOf,
  resolveName,
} from "./names.ts";

const LINH = normalizeSuiAddress("0x5c24");
const OTHER = normalizeSuiAddress("0xbad");
const core = (
  to: string | null,
  name: string | null = "linh.sui",
): NameCore & { calls: number } => {
  const c = {
    calls: 0,
    resolveNameServiceAddress: async () => ({ address: to }),
    defaultNameServiceName: async () => {
      c.calls++;
      return { data: { name } };
    },
  };
  return c;
};

describe(".sui names over gRPC NameService (C1)", () => {
  it("knows a name when it sees one", () => {
    for (const n of ["linh.sui", "team.linh.sui", "@linh", "LINH.SUI"])
      expect(isSuiName(n)).toBe(true);
    for (const n of ["0x5c24", "linh", "linh.eth", "li.sui.com"]) expect(isSuiName(n)).toBe(false);
    expect(canonicalName("@Linh")).toBe("linh.sui");
  });

  it("resolves, and caches reverse lookups for an hour", async () => {
    expect(await resolveName(core("0x5c24"), "linh.sui")).toBe(LINH);
    const c = core(null, "linh.sui");
    const a = normalizeSuiAddress("0xa11ce");
    expect(await nameOf(c, a, 1_000)).toBe("linh.sui");
    expect(await nameOf(c, a, 1_000 + 3_000_000)).toBe("linh.sui");
    expect(c.calls).toBe(1);
    await nameOf(c, a, 1_000 + 3_700_000);
    expect(c.calls).toBe(2);
  });

  it("says when a name moved off the signed address", async () => {
    expect(await nameMoved(core(LINH), { suins: "linh.sui", address: LINH })).toBeNull();
    expect(await nameMoved(core(OTHER), { suins: "linh.sui", address: LINH })).toEqual({
      name: "linh.sui",
      now: OTHER,
    });
    expect(await nameMoved(core(OTHER), { address: LINH })).toBeNull();
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("a moved name stops the payment (C1, Postgres)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x5e1${process.pid.toString(16)}`);
  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("refuses to pay when linh.sui now points elsewhere, and when it can't check", async () => {
    let fetched = 0;
    const deps = {
      db,
      log: createLogger({}, () => {}),
      webBase: "http://web.test",
      networks: {
        config: () => ({ facilitatorUrl: "http://fac.test", usdcCoinType: "0x2::usdc::USDC" }),
        client: () => ({ core: core(OTHER) }),
      },
      fetch: async () => {
        fetched++;
        throw new Error("must not pay");
      },
    } as unknown as RuntimeDeps;
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "errand",
        name: "Errand",
        config: { persona: "x" },
        status: "active",
        address: normalizeSuiAddress("0xabc"),
        discId: "0xd15c",
        allowanceId: "0xa11",
      })
      .returning();
    if (!r) throw new Error("no remora");
    const contact = { name: "Linh", address: LINH, ref: "reef:contact-linh", suins: "linh.sui" };
    const out = await payContact(deps, r as never, {
      contact,
      amount: 50_000n,
      memo: "lunch",
      question: "pay linh.sui 0.05 for lunch",
    });
    expect(out.outcome).toBe("blocked");
    expect(out.answer).toMatch(/linh\.sui now points to 0x000000…0bad, not 0x000000…5c24/);
    expect(fetched).toBe(0);
    const [blocked] = await db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "blocked")));
    expect(blocked?.payload).toMatchObject({ code: "name.moved", now: OTHER, signed: LINH });

    const down = {
      ...deps,
      networks: {
        ...deps.networks,
        client: () => ({
          core: {
            resolveNameServiceAddress: async () => {
              throw new Error("node down");
            },
          },
        }),
      },
    } as unknown as RuntimeDeps;
    const unchecked = await payContact(down, r as never, {
      contact,
      amount: 50_000n,
      memo: "lunch",
      question: "pay linh.sui",
    });
    expect(unchecked.outcome).toBe("blocked");
    expect(unchecked.answer).toMatch(/couldn't check where linh\.sui points/);
  });
});
