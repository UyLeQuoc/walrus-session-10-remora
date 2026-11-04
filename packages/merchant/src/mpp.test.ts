import { randomBytes } from "node:crypto";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, normalizeSuiAddress, toBase58, toBase64 } from "@mysten/sui/utils";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import {
  decodeMpp,
  discFetch,
  encodeMpp,
  encodeMppRequest,
  MPP_CHALLENGE_HEADER,
  MPP_RECEIPT_HEADER,
  type MppChallenge,
  type MppCredential,
  type MppReceipt,
  type MppRequest,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentPayload,
  type PaymentRequired,
  parseChallenges,
} from "@remora/disc-sdk";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { challengeId, suiPaymentProof } from "./mpp.ts";
import { type PaidContext, type X402Options, x402 } from "./x402.ts";

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const MERCHANT = normalizeSuiAddress("0x3e");
const FACILITATOR = "http://facilitator.test";
const URL_ = "http://merchant.test/report";
const SECRET = "door-secret";
const remora = new Ed25519Keypair();
const buyer = new Ed25519Keypair();

interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  challengeId?: string;
}

async function sponsoredBytes() {
  const tx = new Transaction();
  tx.setSender(remora.toSuiAddress());
  tx.setGasOwner(normalizeSuiAddress("0x5905"));
  tx.setGasPayment([
    {
      objectId: normalizeSuiAddress("0x6a5"),
      version: "1",
      digest: "11111111111111111111111111111111",
    },
  ]);
  tx.setGasPrice(1_000);
  tx.setGasBudget(5_000_000);
  tx.moveCall({ target: `${PKG}::disc::pay`, arguments: [tx.pure.u64(1)] });
  return tx.build();
}

type Tx = {
  status: { success: boolean };
  timestampMs: number | null;
  balanceChanges: { coinType: string; address: string; amount: string }[];
  transaction: { sender: string };
};

/** A chain that knows a few executed transactions, read the way `checkDigest` reads them. */
function chain(txs: Record<string, Tx>) {
  return {
    core: {
      waitForTransaction: async ({ digest }: { digest: string }) => {
        const t = txs[digest];
        if (!t) throw new Error("not found");
        return t.status.success ? { Transaction: t } : { FailedTransaction: t };
      },
    },
  } as unknown as ClientWithCoreApi;
}

function world(
  o: {
    valid?: boolean;
    settles?: boolean;
    settle?: "first" | "after";
    status?: number;
    client?: ClientWithCoreApi;
    payTo?: string;
    disc?: boolean;
    mppOnly?: boolean;
  } = {},
) {
  const calls: {
    path: string;
    body: { paymentPayload: PaymentPayload } & Record<string, unknown>;
  }[] = [];
  const order: string[] = [];
  const facilitatorFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    calls.push({ path, body: JSON.parse(String(init?.body ?? "{}")) });
    order.push(path);
    if (path === "/verify")
      return Response.json(
        o.valid === false
          ? { isValid: false, invalidReason: "amount_mismatch" }
          : { isValid: true, payer: remora.toSuiAddress(), intent: "ab".repeat(32) },
      );
    if (path === "/settle")
      return Response.json(
        o.settles === false
          ? { success: false, errorReason: "insufficient_funds" }
          : { success: true, network: "sui:testnet", transaction: "D1g3st", payer: "0xpayer" },
      );
    if (path === "/gas") return Response.json({ transaction: toBase64(await sponsoredBytes()) });
    return new Response("?", { status: 404 });
  }) as typeof fetch;

  const pay: X402Options = {
    amount: "10000",
    description: "Risk report",
    networks: {
      testnet: {
        payTo: o.payTo ?? MERCHANT,
        asset: USDC,
        facilitatorUrl: FACILITATOR,
        ...(o.client ? { client: o.client } : {}),
      },
    },
    ...(o.settle ? { settle: o.settle } : {}),
    ...(o.disc ? { disc: true } : {}),
    mpp: { secret: SECRET },
    fetch: facilitatorFetch,
  };
  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  if (o.mppOnly)
    // An MPP-only merchant: the same challenge, but a Problem Details body with no x402 `accepts`.
    app.use("/report", async (c, next) => {
      await next();
      if (c.res.status !== 402 || c.req.header("authorization")) return;
      c.res = new Response(JSON.stringify({ type: "about:blank", status: 402 }), {
        status: 402,
        headers: {
          "content-type": "application/problem+json",
          "www-authenticate": c.res.headers.get(MPP_CHALLENGE_HEADER) ?? "",
        },
      });
    });
  app.get("/report", x402(pay), (c) => {
    order.push("handler");
    return c.json(
      { ok: o.status === undefined, paid: c.get("x402"), secret: "answer" },
      (o.status ?? 200) as 200,
    );
  });
  const sent: Headers[] = [];
  const clientFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith(FACILITATOR)) return facilitatorFetch(url, init);
    sent.push(new Headers(init?.headers));
    return app.request(url, init);
  }) as typeof fetch;
  return { app, calls, order, sent, clientFetch };
}

async function challengeFrom(app: Hono<{ Variables: { x402: PaidContext } }>) {
  const res = await app.request(URL_);
  const [challenge] = parseChallenges(res.headers.get(MPP_CHALLENGE_HEADER));
  if (!challenge) throw new Error("no challenge");
  return challenge;
}

const authorization = (credential: unknown) => ({
  authorization: `Payment ${encodeMpp(credential)}`,
});

async function signedPayload() {
  const bytes = await sponsoredBytes();
  const { signature } = await remora.signTransaction(bytes);
  return { type: "transaction", transaction: toBase64(bytes), signature };
}

describe("MPP on every x402 door: the challenge (ADR-0120)", () => {
  it("adds a bound sui charge challenge to the 402, and keeps x402's body", async () => {
    const before = Date.now();
    const res = await world().app.request(URL_);
    expect(res.status).toBe(402);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as PaymentRequired;
    expect(body.error).toBe("payment required");
    expect(body.accepts).toEqual([
      expect.objectContaining({ network: "sui:testnet", amount: "10000", payTo: MERCHANT }),
    ]);

    const [ch, ...more] = parseChallenges(res.headers.get(MPP_CHALLENGE_HEADER));
    expect(more).toEqual([]);
    expect(ch).toMatchObject({
      realm: "merchant.test",
      method: "sui",
      intent: "charge",
      description: "Risk report",
    });
    // JCS: sorted keys, no whitespace; base64url without padding; amount in whole USDC (@suimpp/mpp).
    expect(ch?.request).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(ch?.request ?? "", "base64url").toString()).toBe(
      `{"amount":"0.01","currency":"${USDC}","methodDetails":{"decimals":6,"gasStation":"${FACILITATOR}/gas","network":"testnet"},"recipient":"${MERCHANT}"}`,
    );
    expect(ch?.expires).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    const ttl = Date.parse(ch?.expires ?? "") - before;
    expect(ttl).toBeGreaterThan(298_000);
    expect(ttl).toBeLessThanOrEqual(301_000);
    expect(ch?.id).toBe(challengeId(SECRET, ch as MppChallenge));
  });

  it("never issues the same id twice, even for the same price in the same second", async () => {
    const w = world();
    const [a, b] = await Promise.all([challengeFrom(w.app), challengeFrom(w.app)]);
    expect(a.request).toBe(b.request);
    expect(a.id).not.toBe(b.id);
    expect(decodeMpp<{ nonce: string }>(a.opaque ?? "").nonce).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });

  it("binds ids as the draft's HMAC-SHA256 test vector does", () => {
    expect(
      challengeId("test-vector-secret", {
        realm: "api.example.com",
        method: "tempo",
        intent: "charge",
        request: "eyJhbW91bnQiOiIxMDAwMDAwIn0",
      }),
    ).toBe("X6v1eo7fJ76gAxqY0xN9Jd__4lUyDDYmriryOM-5FO4");
  });

  it("turns off with mpp: false, leaving the plain x402 402", async () => {
    const a = new Hono();
    a.get(
      "/r",
      x402({
        amount: "1",
        networks: { testnet: { payTo: MERCHANT, asset: USDC, facilitatorUrl: FACILITATOR } },
        mpp: false,
      }),
      (c) => c.json({}),
    );
    const res = await a.request("/r");
    expect(res.status).toBe(402);
    expect(res.headers.get(MPP_CHALLENGE_HEADER)).toBeNull();
  });
});

describe("MPP credentials (ADR-0120)", () => {
  it("settles a signed transaction through the facilitator and answers with a receipt", async () => {
    const w = world();
    const challenge = await challengeFrom(w.app);
    const res = await w.app.request(URL_, {
      headers: authorization({
        challenge,
        source: "did:pkh:sui:testnet:0x1",
        payload: await signedPayload(),
      }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { paid: PaidContext }).paid).toMatchObject({
      network: "testnet",
      transaction: "D1g3st",
      intent: "ab".repeat(32),
    });
    expect(w.calls.map((c) => c.path)).toEqual(["/verify", "/settle"]);
    // The facilitator sees exactly what an x402 payment would send.
    const sent = w.calls[0]?.body;
    expect(sent?.paymentPayload).toMatchObject({ scheme: "exact", network: "sui:testnet" });
    expect(sent?.paymentRequirements).toMatchObject({ amount: "10000", payTo: MERCHANT });

    const header = res.headers.get(MPP_RECEIPT_HEADER) ?? "";
    expect(header).toMatch(/^[A-Za-z0-9_-]+$/);
    const receipt = decodeMpp<MppReceipt>(header);
    expect(receipt).toEqual({
      status: "success",
      method: "sui",
      timestamp: expect.stringMatching(/Z$/),
      reference: "D1g3st",
    });
    expect(res.headers.get("cache-control")).toBe("private");
    expect(res.headers.get(PAYMENT_RESPONSE_HEADER)).toBeNull();
  });

  it("refuses a replayed challenge with a fresh one", async () => {
    const w = world();
    const challenge = await challengeFrom(w.app);
    const headers = authorization({ challenge, payload: await signedPayload() });
    expect((await w.app.request(URL_, { headers })).status).toBe(200);
    const again = await w.app.request(URL_, { headers });
    expect(again.status).toBe(402);
    expect(again.headers.get("content-type")).toBe("application/problem+json");
    expect(again.headers.get("cache-control")).toBe("no-store");
    const problem = (await again.json()) as Problem;
    expect(problem).toMatchObject({
      type: "https://paymentauth.org/problems/invalid-challenge",
      title: "Invalid Challenge",
      status: 402,
      detail: "That challenge was already used.",
    });
    const [fresh] = parseChallenges(again.headers.get(MPP_CHALLENGE_HEADER));
    expect(fresh?.id).toBe(problem.challengeId);
    expect(fresh?.id).not.toBe(challenge.id);
    expect(again.headers.get(MPP_RECEIPT_HEADER)).toBeNull();
    expect(w.calls.map((c) => c.path)).toEqual(["/verify", "/settle"]);
  });

  it("refuses an expired challenge", async () => {
    const w = world();
    const issued = await challengeFrom(w.app);
    const bound = { ...issued, expires: "2026-01-01T00:00:00Z" };
    const challenge = { ...bound, id: challengeId(SECRET, bound) };
    const res = await w.app.request(URL_, {
      headers: authorization({ challenge, payload: await signedPayload() }),
    });
    expect(res.status).toBe(402);
    expect(((await res.json()) as Problem).type).toBe(
      "https://paymentauth.org/problems/payment-expired",
    );
    expect(w.calls).toEqual([]);
  });

  it("refuses a challenge whose request was changed, another door's, or another realm's", async () => {
    const w = world();
    const issued = await challengeFrom(w.app);
    const request = decodeMpp<MppRequest>(issued.request);
    const cheaper = { ...issued, request: encodeMppRequest({ ...request, amount: "0.001" }) };
    const elsewhere = await challengeFrom(world({ payTo: normalizeSuiAddress("0x99") }).app);
    const realm = { ...issued, realm: "other.test" };
    for (const challenge of [cheaper, elsewhere, realm, { ...issued, id: "forged" }]) {
      const res = await w.app.request(URL_, {
        headers: authorization({ challenge, payload: await signedPayload() }),
      });
      expect(res.status).toBe(402);
      expect(((await res.json()) as Problem).title).toBe("Invalid Challenge");
    }
    expect(w.calls).toEqual([]);
  });

  it("answers a malformed credential with 402 and a fresh challenge, two credentials with 400", async () => {
    const w = world();
    const challenge = await challengeFrom(w.app);
    const malformed = await w.app.request(URL_, { headers: { authorization: "Payment @@@" } });
    expect(malformed.status).toBe(402);
    expect(((await malformed.json()) as Problem).title).toBe("Malformed Credential");
    expect(parseChallenges(malformed.headers.get(MPP_CHALLENGE_HEADER))).toHaveLength(1);
    const notACredential = await w.app.request(URL_, { headers: authorization({ hello: 1 }) });
    expect(((await notACredential.json()) as Problem).title).toBe("Malformed Credential");
    const noPayload = await w.app.request(URL_, {
      headers: authorization({ challenge, payload: { proof: "0xabc" } }),
    });
    expect(((await noPayload.json()) as Problem).title).toBe("Invalid Payload");

    const one = encodeMpp({ challenge, payload: await signedPayload() });
    for (const headers of [
      { authorization: `Payment ${one}, Payment ${one}` },
      { authorization: `Payment ${one}`, "payment-authorization": `Payment ${one}` },
      { authorization: `Payment ${one}`, [PAYMENT_HEADER]: "e30=" },
    ]) {
      const res = await w.app.request(URL_, { headers });
      expect(res.status).toBe(400);
      expect(((await res.json()) as Problem).type).toBe(
        "https://paymentauth.org/problems/bad-request",
      );
      expect(res.headers.get(MPP_CHALLENGE_HEADER)).toBeNull();
    }
    expect(w.calls).toEqual([]);
  });

  it("gives a receipt only with a 2xx", async () => {
    const refused = world({ valid: false });
    const challenge = await challengeFrom(refused.app);
    const res = await refused.app.request(URL_, {
      headers: authorization({ challenge, payload: await signedPayload() }),
    });
    expect(res.status).toBe(402);
    expect(((await res.json()) as Problem).detail).toBe("amount_mismatch");
    expect(res.headers.get(MPP_RECEIPT_HEADER)).toBeNull();

    const failing = world({ status: 500 });
    const second = await challengeFrom(failing.app);
    const failed = await failing.app.request(URL_, {
      headers: authorization({ challenge: second, payload: await signedPayload() }),
    });
    expect(failed.status).toBe(500);
    expect(failed.headers.get(MPP_RECEIPT_HEADER)).toBeNull();
  });
});

describe('MPP with settle: "after" (ADR-0111, ADR-0120)', () => {
  it("verifies, answers, then settles, and the receipt carries the settled digest", async () => {
    const w = world({ settle: "after" });
    const challenge = await challengeFrom(w.app);
    const res = await w.app.request(URL_, {
      headers: authorization({ challenge, payload: await signedPayload() }),
    });
    expect(res.status).toBe(200);
    expect(w.order).toEqual(["/verify", "handler", "/settle"]);
    expect(decodeMpp<MppReceipt>(res.headers.get(MPP_RECEIPT_HEADER) ?? "").reference).toBe(
      "D1g3st",
    );
  });

  it("never settles a failed answer, and replaces an unsettled one with the 402", async () => {
    const failing = world({ settle: "after", status: 502 });
    const c1 = await challengeFrom(failing.app);
    const failed = await failing.app.request(URL_, {
      headers: authorization({ challenge: c1, payload: await signedPayload() }),
    });
    expect(failed.status).toBe(502);
    expect(failing.order).toEqual(["/verify", "handler"]);
    expect(failed.headers.get(MPP_RECEIPT_HEADER)).toBeNull();

    const unsettled = world({ settle: "after", settles: false });
    const c2 = await challengeFrom(unsettled.app);
    const res = await unsettled.app.request(URL_, {
      headers: authorization({ challenge: c2, payload: await signedPayload() }),
    });
    expect(res.status).toBe(402);
    const body = await res.text();
    expect(body).not.toContain("answer");
    expect(JSON.parse(body)).toMatchObject({
      title: "Verification Failed",
      detail: "insufficient_funds",
    });
    expect(parseChallenges(res.headers.get(MPP_CHALLENGE_HEADER))).toHaveLength(1);
  });
});

describe("MPP digest credentials, as @suimpp/mpp sends them (ADR-0120)", () => {
  const digest = () => toBase58(randomBytes(32));
  const paidTx = (o: Partial<Tx> & { amount?: string } = {}): Tx => ({
    status: { success: true },
    timestampMs: null,
    balanceChanges: [
      { coinType: USDC, address: MERCHANT, amount: o.amount ?? "10000" },
      { coinType: USDC, address: buyer.toSuiAddress(), amount: `-${o.amount ?? "10000"}` },
    ],
    transaction: { sender: buyer.toSuiAddress() },
    ...o,
  });
  async function credential(challenge: MppChallenge, d: string, signer = buyer) {
    const request = decodeMpp<MppRequest>(challenge.request);
    const { signature } = await signer.signPersonalMessage(suiPaymentProof(challenge, request, d));
    return { challenge, payload: { digest: d, signature } } satisfies MppCredential;
  }

  it("reads the executed payment over gRPC, without the facilitator, and spends the digest once", async () => {
    const d = digest();
    const w = world({ client: chain({ [d]: paidTx() }) });
    const res = await w.app.request(URL_, {
      headers: authorization(await credential(await challengeFrom(w.app), d)),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { paid: PaidContext }).paid).toEqual({
      network: "testnet",
      payer: buyer.toSuiAddress(),
      transaction: d,
    });
    expect(decodeMpp<MppReceipt>(res.headers.get(MPP_RECEIPT_HEADER) ?? "").reference).toBe(d);
    expect(w.calls).toEqual([]);

    // The same payment can't buy a second call, even signed for a fresh challenge.
    const again = await w.app.request(URL_, {
      headers: authorization(await credential(await challengeFrom(w.app), d)),
    });
    expect(again.status).toBe(402);
    expect(((await again.json()) as Problem).detail).toBe(
      "That transaction already paid for a call.",
    );
  });

  it("refuses a short, failed, stale, someone else's or unreadable payment", async () => {
    const [short, failed, stale, theirs, missing] = [
      digest(),
      digest(),
      digest(),
      digest(),
      digest(),
    ];
    const client = chain({
      [short]: paidTx({ amount: "9999" }),
      [failed]: paidTx({ status: { success: false } }),
      [stale]: paidTx({ timestampMs: Date.parse("2026-01-01T00:00:00Z") }),
      [theirs]: paidTx(),
    });
    const w = world({ client });
    const cases: [string, Ed25519Keypair, string][] = [
      [short, buyer, "It credited 9999 to the payee, short of 10000."],
      [failed, buyer, "The transaction failed onchain."],
      [stale, buyer, "The transaction is older than the challenge."],
      [
        theirs,
        remora,
        "The payment proof isn't signed by the transaction's sender for this challenge.",
      ],
      [missing, buyer, `Couldn't find transaction ${missing}.`],
      ["not-a-digest", buyer, "That isn't a transaction digest."],
    ];
    for (const [d, signer, detail] of cases) {
      const res = await w.app.request(URL_, {
        headers: authorization(await credential(await challengeFrom(w.app), d, signer)),
      });
      expect(res.status, detail).toBe(402);
      expect(((await res.json()) as Problem).detail).toBe(detail);
    }
  });

  it("accepts the credential exactly as mppx + @suimpp/mpp 0.9.0 serialize it", async () => {
    // mppx's Credential.serialize: the challenge spread with `request` re-encoded as JCS and
    // `opaque` left decoded (an object), `description` echoed, then JSON and base64url.
    const d = digest();
    const w = world({ client: chain({ [d]: paidTx() }) });
    const issued = await challengeFrom(w.app);
    const { payload } = await credential(issued, d);
    const wire = {
      challenge: {
        id: issued.id,
        realm: issued.realm,
        method: issued.method,
        intent: issued.intent,
        request: encodeMppRequest(decodeMpp(issued.request)),
        description: issued.description,
        expires: issued.expires,
        opaque: decodeMpp(issued.opaque ?? ""),
      },
      payload,
    };
    const res = await w.app.request(URL_, {
      headers: {
        authorization: `Payment ${Buffer.from(JSON.stringify(wire)).toString("base64url")}`,
      },
    });
    expect(res.status).toBe(200);
  });

  it("refuses digests at a door that can't read the chain, or that takes Disc payments only", async () => {
    for (const w of [world(), world({ disc: true, client: chain({}) })]) {
      const res = await w.app.request(URL_, {
        headers: authorization(await credential(await challengeFrom(w.app), digest())),
      });
      expect(res.status).toBe(402);
      expect(((await res.json()) as Problem).title).toBe("Verification Failed");
    }
  });

  it('serves a settle: "after" door too: the payment is already final', async () => {
    const d = digest();
    const w = world({ settle: "after", client: chain({ [d]: paidTx() }) });
    const res = await w.app.request(URL_, {
      headers: authorization(await credential(await challengeFrom(w.app), d)),
    });
    expect(res.status).toBe(200);
    expect(w.order).toEqual(["handler"]);
    expect(res.headers.get(MPP_RECEIPT_HEADER)).not.toBeNull();
  });
});

describe("disc.fetch over MPP (E2, ADR-0120)", () => {
  const base = {
    network: "testnet" as const,
    cfg: { packageId: PKG, registryId: normalizeSuiAddress("0x47"), coinType: USDC },
    disc: {
      discId: normalizeSuiAddress("0xd1"),
      allowanceId: normalizeSuiAddress("0xa11"),
      funder: normalizeSuiAddress("0x0f"),
    },
    sender: remora.toSuiAddress(),
    sign: async (bytes: Uint8Array) => (await remora.signTransaction(bytes)).signature,
    intentFor: () => new Uint8Array(32).fill(0xab),
    buildKind: async () => new Uint8Array([0, 1, 2]),
    maxAmount: 20_000n,
  };

  it("pays a 402 that offers only MPP with the same sponsored Disc payment", async () => {
    const w = world({ mppOnly: true });
    const first = await w.app.request(URL_);
    expect(first.headers.get("content-type")).toBe("application/problem+json");

    const { response, payment } = await discFetch({ ...base, fetch: w.clientFetch }, URL_);
    expect(response.status).toBe(200);
    expect(payment).toMatchObject({
      protocol: "mpp",
      requirements: { amount: "10000", payTo: MERCHANT, asset: USDC },
      settle: { success: true, transaction: "D1g3st", payer: remora.toSuiAddress() },
    });
    expect(w.calls.map((c) => c.path)).toEqual(["/gas", "/verify", "/settle"]);
    const retry = w.sent[1];
    expect(retry?.get(PAYMENT_HEADER)).toBeNull();
    const sent = decodeMpp<MppCredential>(
      (retry?.get("authorization") ?? "").replace(/^Payment /, ""),
    );
    expect(sent.source).toBe(`did:pkh:sui:testnet:${remora.toSuiAddress()}`);
    // The facilitator got the remora's signature over exactly the sponsored bytes.
    const paid = w.calls.find((c) => c.path === "/verify")?.body.paymentPayload;
    const pk = await verifyTransactionSignature(
      fromBase64(paid?.payload.transaction ?? ""),
      paid?.payload.signature ?? "",
    );
    expect(pk.toSuiAddress()).toBe(remora.toSuiAddress());
  });

  it("prefers x402 when the 402 offers both", async () => {
    const w = world();
    const { response, payment } = await discFetch({ ...base, fetch: w.clientFetch }, URL_);
    expect(response.status).toBe(200);
    expect(payment?.protocol).toBe("x402");
    expect(w.sent[1]?.get("authorization")).toBeNull();
    expect(w.sent[1]?.get(PAYMENT_HEADER)).not.toBeNull();
  });

  it("refuses an MPP-only 402 over its soft budget before building anything", async () => {
    const w = world({ mppOnly: true });
    await expect(
      discFetch({ ...base, maxAmount: 5_000n, fetch: w.clientFetch }, URL_),
    ).rejects.toMatchObject({ code: "x402.over_soft_budget" });
    expect(w.calls).toEqual([]);
  });
});
