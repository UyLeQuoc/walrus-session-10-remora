import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  decodeHeader,
  encodeHeader,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
} from "@remora/disc-sdk";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { type PaidContext, x402 } from "./x402.ts";

const FACILITATOR = "http://facilitator.test";
const header = encodeHeader({ x402Version: 2, network: "sui:testnet", payload: {} });

function app(handler: () => Response | Promise<Response>, o: { settles?: boolean } = {}) {
  const calls: string[] = [];
  const order: string[] = [];
  const a = new Hono<{ Variables: { x402: PaidContext } }>();
  a.get(
    "/answer",
    x402({
      amount: "20000",
      settle: "after",
      networks: {
        testnet: {
          payTo: normalizeSuiAddress("0x3e"),
          asset: `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`,
          facilitatorUrl: FACILITATOR,
        },
      },
      fetch: (async (input: string | URL | Request) => {
        const path = new URL(String(input)).pathname;
        calls.push(path);
        order.push(path);
        if (path === "/verify") return Response.json({ isValid: true, payer: "0xbuyer" });
        return Response.json(
          o.settles === false
            ? { success: false, errorReason: "insufficient_funds" }
            : { success: true, transaction: "S3ttled", payer: "0xbuyer" },
        );
      }) as typeof fetch,
    }),
    async (c) => {
      order.push(`handler (payer ${c.get("x402").payer}, tx "${c.get("x402").transaction}")`);
      return handler();
    },
  );
  return { a, calls, order };
}

describe('x402 settle: "after" (ADR-0111)', () => {
  it("does no work on the unpaid first call", async () => {
    let ran = false;
    const w = app(() => {
      ran = true;
      return Response.json({});
    });
    expect((await w.a.request("/answer")).status).toBe(402);
    expect(ran).toBe(false);
    expect(w.calls).toEqual([]);
  });

  it("verifies, runs the handler, then settles, and returns the receipt header", async () => {
    const w = app(() => Response.json({ answer: "42" }));
    const res = await w.a.request("/answer", { headers: { [PAYMENT_HEADER]: header } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answer: "42" });
    expect(w.order).toEqual(["/verify", 'handler (payer 0xbuyer, tx "")', "/settle"]);
    const receipt = decodeHeader<{ transaction: string }>(
      res.headers.get(PAYMENT_RESPONSE_HEADER) ?? "",
    );
    expect(receipt.transaction).toBe("S3ttled");
  });

  it("never settles when the handler fails, so the buyer pays nothing", async () => {
    const w = app(() => Response.json({ error: "the remora couldn't answer" }, { status: 502 }));
    const res = await w.a.request("/answer", { headers: { [PAYMENT_HEADER]: header } });
    expect(res.status).toBe(502);
    expect(w.calls).toEqual(["/verify"]);
    expect(res.headers.get(PAYMENT_RESPONSE_HEADER)).toBeNull();
  });

  it("replaces the answer with the 402 when settlement fails, so it never leaks unpaid", async () => {
    const w = app(() => Response.json({ answer: "secret" }), { settles: false });
    const res = await w.a.request("/answer", { headers: { [PAYMENT_HEADER]: header } });
    expect(res.status).toBe(402);
    const body = await res.text();
    expect(body).not.toContain("secret");
    expect(JSON.parse(body).error).toBe("insufficient_funds");
  });
});
