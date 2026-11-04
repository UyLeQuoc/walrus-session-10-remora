import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { approvals, createDb, eq, remoraEvents, remoras } from "@remora/db";
import { decodeHeader, type PaymentRequired } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import {
  contactEntries,
  contactFetch,
  contactPayUrl,
  contactSlug,
  findContact,
  toContact,
} from "../money/contacts.ts";
import { payeeLabel } from "../money/reef.ts";
import type { RuntimeDeps } from "./deps.ts";
import { errandAsk, parsePayText, usualFor } from "./errand.ts";

const LINH = normalizeSuiAddress("0x11a4");

describe("Errand words and contacts (B1)", () => {
  it("reads a payment in plain words, English or Vietnamese", () => {
    expect(parsePayText("pay Linh 2 USDC for lunch")).toEqual({
      who: "Linh",
      amount: 2_000_000n,
      memo: "lunch",
    });
    expect(parsePayText("Send $0.5 to Huy for the taxi")).toEqual({
      who: "Huy",
      amount: 500_000n,
      memo: "the taxi",
    });
    expect(parsePayText("trả Linh 1,25 usdc tiền ăn trưa")).toEqual({
      who: "Linh",
      amount: 1_250_000n,
      memo: "ăn trưa",
    });
    expect(parsePayText("pay Linh Tran 3")).toEqual({
      who: "Linh Tran",
      amount: 3_000_000n,
      memo: "",
    });
    expect(parsePayText("what's the weather")).toBeNull();
    expect(parsePayText("pay Linh lots")).toBeNull();
  });

  it("turns a name into a Reef-shaped ref, and back into a label", () => {
    expect(contactSlug("Linh Trần")).toBe("linh-tran");
    expect(contactSlug("Đức")).toBe("duc");
    const c = toContact(" Linh  Tran ", "0x11a4");
    expect(c).toEqual({ name: "Linh Tran", address: LINH, ref: "reef:contact-linh-tran" });
    expect(payeeLabel(c.ref)).toBe("Linh Tran");
    expect(() => toContact("Linh", "not-an-address")).toThrow(/isn't a Sui address/);
    expect(() => toContact("!!", "0x1")).toThrow(/needs a name/);
    const r = { config: { contacts: [c] } };
    expect(findContact(r, "linh tran")).toEqual(c);
    expect(findContact(r, "reef:contact-linh-tran")).toEqual(c);
    expect(findContact(r, "Huy")).toBeNull();
    expect(contactEntries(r)).toEqual([
      expect.objectContaining({ ref: c.ref, payTo: LINH, url: "contact://linh-tran/pay" }),
    ]);
  });

  it("answers a contact's URL with a 402 at the contact's own address, and passes others on", async () => {
    const c = toContact("Linh", "0x11a4");
    const seen: string[] = [];
    const http = contactFetch({
      contact: c,
      amount: 2_000_000n,
      network: "testnet",
      asset: "0x2::usdc::USDC",
      facilitatorUrl: "http://fac.test",
      fetch: (async (u: string) => {
        seen.push(String(u));
        return new Response("ok");
      }) as unknown as typeof fetch,
    });
    const res = await http(contactPayUrl(c, "lunch"));
    expect(res.status).toBe(402);
    const body = (await res.json()) as PaymentRequired;
    expect(body.accepts[0]).toMatchObject({
      payTo: LINH,
      amount: "2000000",
      network: "sui:testnet",
      extra: { gasStation: "http://fac.test/gas", disc: true },
    });
    await http("http://elsewhere.test/x");
    expect(seen).toEqual(["http://elsewhere.test/x"]);
    expect(decodeHeader).toBeTypeOf("function");
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("Errand in Postgres (B1)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0e7${process.pid.toString(16)}`);
  const told: string[] = [];
  const deps = {
    db,
    log: createLogger({}, () => {}),
    webBase: "http://web.test",
    networks: {
      config: () => ({ facilitatorUrl: "http://fac.test", usdcCoinType: "0x2::usdc::USDC" }),
    },
    notifier: {
      send: async (_o: string, n: { text: string }) => {
        told.push(n.text);
        return "sent" as const;
      },
    },
  } as unknown as RuntimeDeps;

  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("asks before 3x a contact's usual, and hints when it can't tell who or how much", async () => {
    const linh = toContact("Linh", "0x11a4");
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "errand",
        name: "Errand",
        config: { contacts: [linh] },
        status: "active",
        address: normalizeSuiAddress("0xe44"),
      })
      .returning();
    if (!r) throw new Error("no remora");
    expect(await usualFor(deps, r, linh)).toBeNull();
    for (const amount of ["2000000", "1000000", "2000000"])
      await db.insert(remoraEvents).values({
        remoraId: r.id,
        network: "testnet",
        type: "payment",
        summary: "Paid",
        payload: { payee: linh.ref, amount },
      });
    expect(await usualFor(deps, r, linh)).toBe(2_000_000n);

    const big = await errandAsk(deps, r, "pay Linh 6 USDC for dinner");
    expect(big.outcome).toBe("unusual");
    expect(big.answer).toMatch(/6\.00 USDC, 3x or more what you usually send Linh \(2\.00\)/);
    const [a] = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, big.approvalId as string));
    expect(a?.payload).toMatchObject({
      payee: linh.ref,
      payTo: linh.address,
      amount: "6000000",
      viaDisc: true,
      contact: true,
      url: "contact://linh/pay?memo=dinner",
    });
    expect(told.at(-1)).toMatch(/^Errand: That's 6\.00 USDC/);

    const who = await errandAsk(deps, r, "pay Huy 1 USDC");
    expect(who).toMatchObject({ outcome: "unclear" });
    expect(who.answer).toMatch(/Huy isn't one of my contacts.*I can pay: Linh/);
    const what = await errandAsk(deps, r, "hello");
    expect(what.answer).toMatch(/pay Linh 2 USDC for lunch/);
  });
});
