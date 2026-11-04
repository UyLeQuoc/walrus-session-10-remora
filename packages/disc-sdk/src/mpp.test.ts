import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  decodeMpp,
  encodeMpp,
  encodeMppRequest,
  formatChallenge,
  fromBase64url,
  fromWholeUnits,
  type MppChallenge,
  type MppRequest,
  mppNetwork,
  mppRequirements,
  parseChallenges,
  paymentCredentials,
  toBase64url,
  toWholeUnits,
} from "./mpp.ts";

const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const PAYEE = normalizeSuiAddress("0x3e");

const challenge = (request: MppRequest, over: Partial<MppChallenge> = {}): MppChallenge => ({
  id: "x7Tg2pLqR9mKvNwY3hBcZa",
  realm: "merchant.test",
  method: "sui",
  intent: "charge",
  request: encodeMppRequest(request),
  expires: "2026-11-05T12:05:00Z",
  ...over,
});

describe("MPP wire format (ADR-0120)", () => {
  it("encodes base64url without padding, UTF-8 safe", () => {
    expect(toBase64url('{"amount":"1000000"}')).toBe("eyJhbW91bnQiOiIxMDAwMDAwIn0");
    const odd = toBase64url("ü?>");
    expect(odd).not.toMatch(/[=+/]/);
    expect(fromBase64url(odd)).toBe("ü?>");
    expect(() => fromBase64url("not base64!")).toThrow();
  });

  it("serializes JSON canonically (RFC 8785): sorted keys at every depth, no whitespace", () => {
    expect(
      canonicalJson({
        recipient: "0x3e",
        amount: "0.01",
        methodDetails: { network: "t", disc: true },
      }),
    ).toBe('{"amount":"0.01","methodDetails":{"disc":true,"network":"t"},"recipient":"0x3e"}');
    expect(canonicalJson({ b: [3, { z: null, a: 1.5 }], a: "é" })).toBe(
      '{"a":"é","b":[3,{"a":1.5,"z":null}]}',
    );
    expect(canonicalJson({ a: 1, skip: undefined })).toBe('{"a":1}');
  });

  it("writes challenges the parser reads back, with quoting, beside other schemes", () => {
    const one = challenge(
      { amount: "0.01", currency: USDC, recipient: PAYEE },
      { description: 'A "quoted" \\ answer' },
    );
    const two = challenge({ amount: "0.02", currency: USDC, recipient: PAYEE }, { id: "second" });
    const header = `Bearer realm="api", ${formatChallenge(one)}, Basic realm=x, ${formatChallenge(two)}`;
    expect(parseChallenges(header)).toEqual([one, two]);
    // A challenge without its required params is dropped.
    expect(parseChallenges('Payment id="", realm="r", method="sui", intent="charge"')).toEqual([]);
  });

  it("finds Payment credentials in Authorization, one per scheme", () => {
    expect(paymentCredentials("Payment abc")).toEqual(["abc"]);
    expect(paymentCredentials("Bearer t, Payment abc, payment def")).toEqual(["abc", "def"]);
    expect(paymentCredentials("Bearer t")).toEqual([]);
    expect(paymentCredentials(undefined)).toEqual([]);
  });

  it("converts between base units and @suimpp/mpp's whole-unit amounts", () => {
    expect(toWholeUnits(5_000n, 6)).toBe("0.005");
    expect(toWholeUnits(10_000n, 6)).toBe("0.01");
    expect(toWholeUnits(1_500_000n, 6)).toBe("1.5");
    expect(toWholeUnits(2_000_000n, 6)).toBe("2");
    expect(fromWholeUnits("0.005", 6)).toBe(5_000n);
    expect(fromWholeUnits("2", 6)).toBe(2_000_000n);
    expect(fromWholeUnits(".5", 6)).toBe(500_000n);
    expect(fromWholeUnits("0.0000001", 6)).toBeNull();
    expect(fromWholeUnits("1e3", 6)).toBeNull();
    expect(fromWholeUnits("", 6)).toBeNull();
  });

  it("reads a credential's network from its challenge's request", () => {
    const req = { amount: "0.01", currency: USDC, recipient: PAYEE };
    const pay = (r: MppRequest) =>
      `Payment ${encodeMpp({ challenge: challenge(r), payload: { digest: "d", signature: "s" } })}`;
    expect(mppNetwork(pay({ ...req, methodDetails: { network: "testnet" } }))).toBe("testnet");
    expect(mppNetwork(pay(req))).toBeNull();
    expect(mppNetwork("Payment %%%")).toBeNull();
    expect(mppNetwork(undefined)).toBeNull();
  });

  it("turns the first payable sui charge into x402 requirements, skipping the rest", () => {
    const now = Date.parse("2026-11-05T12:00:00Z");
    const testnet: MppRequest = {
      amount: "0.01",
      currency: USDC,
      recipient: PAYEE,
      methodDetails: { network: "testnet", decimals: 6, gasStation: "http://fac.test/gas" },
    };
    const offers = [
      challenge(testnet, { id: "expired", expires: "2026-11-05T11:59:00Z" }),
      challenge(testnet, { id: "tempo", method: "tempo" }),
      challenge({ ...testnet, methodDetails: { network: "mainnet" } }, { id: "mainnet" }),
      challenge({ ...testnet, currency: "0x2::sui::SUI" }, { id: "sui" }),
      challenge({ ...testnet, amount: "lots" }, { id: "nonsense" }),
      challenge(testnet, { id: "good", description: "A haiku" }),
    ];
    const found = mppRequirements(offers, {
      network: "testnet",
      coinType: USDC,
      resource: "http://merchant.test/haiku",
      now,
    });
    expect(found?.challenge.id).toBe("good");
    expect(found?.requirements).toEqual({
      scheme: "exact",
      network: "sui:testnet",
      amount: "10000",
      asset: USDC,
      payTo: PAYEE,
      maxTimeoutSeconds: 300,
      resource: "http://merchant.test/haiku",
      description: "A haiku",
      extra: { gasStation: "http://fac.test/gas" },
    });
    // @suimpp/mpp's request has no methodDetails: the coin type pins the network.
    const plain = mppRequirements(
      [challenge({ amount: "0.005", currency: USDC, recipient: PAYEE })],
      { network: "testnet", coinType: USDC, resource: "r", now },
    );
    expect(plain?.requirements).toMatchObject({ amount: "5000", extra: {} });
    expect(decodeMpp<MppRequest>(offers[5]?.request ?? "").amount).toBe("0.01");
  });
});
