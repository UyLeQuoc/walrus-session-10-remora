import type { PaidContext, X402Options } from "@remora/merchant";
import { fetchPage, isPrivateAddress, textOf } from "@remora/merchant";
import { describe, expect, it } from "vitest";
import { createBriefApp, firstSentences } from "./brief.ts";
import { createOddsApp, oddsFor, snapshot } from "./odds.ts";
import { riskOf } from "./sui-risk.ts";

const USDC = "0xa1ec::usdc::USDC";
const settled: string[] = [];
const facilitator = (async (input: string | URL | Request) => {
  const path = new URL(String(input)).pathname;
  settled.push(path);
  if (path === "/verify") return Response.json({ isValid: true, payer: "0xb0b" });
  return Response.json({
    success: true,
    network: "sui:testnet",
    transaction: "Dg1",
    payer: "0xb0b",
  });
}) as typeof fetch;
const pay: X402Options = {
  amount: "10000",
  networks: { testnet: { payTo: "0x3e", asset: USDC, facilitatorUrl: "http://fac.test" } },
  fetch: facilitator,
};
const paidHeader = {
  "x-payment": Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: "sui:testnet",
      payload: { signature: "s", transaction: "t" },
    }),
  ).toString("base64"),
};

describe("odds (E9)", () => {
  it("returns the fixtures a query names, or the whole snapshot", () => {
    expect(oddsFor("odds for Arsenal tonight?").map((f) => f.home)).toEqual(["Arsenal"]);
    expect(oddsFor("anything on Barcelona").map((f) => f.away)).toEqual(["Barcelona"]);
    expect(oddsFor("hello")).toHaveLength(snapshot().fixtures.length);
  });

  it("dates the snapshot from the request, so tonight always has a match", () => {
    const afternoon = snapshot(Date.parse("2026-11-03T13:10:00Z"));
    expect(afternoon.now).toBe("2026-11-03T13:10:00.000Z");
    expect(afternoon.fixtures.map((f) => f.kickoff).slice(0, 2)).toEqual([
      "2026-11-03T19:00:00.000Z",
      "2026-11-03T21:00:00.000Z",
    ]);
    // Late in the evening, "tonight" is the next one.
    const late = Date.parse("2026-11-03T20:00:00Z");
    const next = snapshot(late).fixtures.map((f) => Date.parse(f.kickoff));
    expect(new Date(Math.min(...next)).toISOString()).toBe("2026-11-04T19:00:00.000Z");
    expect(Math.max(...next) - late).toBeLessThan(3 * 24 * 3_600_000);
  });

  it("asks for payment, then answers with the labelled snapshot", async () => {
    const app = createOddsApp({ pay });
    expect((await app.request("/odds?q=Liverpool")).status).toBe(402);
    const res = await app.request("/odds?q=Liverpool", { headers: paidHeader });
    const body = (await res.json()) as { note: string; fixtures: unknown[]; paid: PaidContext };
    expect(body.note).toMatch(/not live/);
    expect(body.fixtures).toHaveLength(1);
    expect(body.paid.transaction).toBe("Dg1");
  });
});

describe("sui-risk (E9)", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");
  /** A package whose last change was a day ago. */
  const client = {
    core: {
      getObject: async ({ objectId }: { objectId: string }) => ({
        object: {
          objectId,
          type: "package",
          version: "40",
          owner: "Immutable",
          previousTransaction: "Tx1",
        },
      }),
      getTransaction: async () => ({
        Transaction: {
          timestampMs: now - 86_400_000,
          effects: { changedObjects: [] },
          objectTypes: {},
        },
      }),
    },
  } as unknown as Parameters<typeof riskOf>[0];

  it("flags a package changed in the last week", async () => {
    const r = await riskOf(client, "testnet", `0x${"ab".repeat(32)}`, now);
    expect(r.systemPackage).toBe(false);
    expect(r.flags).toEqual(["younger than 7 days"]);
  });

  it("reports pruned history as unknown instead of failing after the buyer paid", async () => {
    const pruned = {
      core: {
        ...client.core,
        getTransaction: async () => {
          throw new Error("Transaction Tx1 not found");
        },
      },
    } as unknown as Parameters<typeof riskOf>[0];
    const r = await riskOf(pruned, "testnet", `0x${"ab".repeat(32)}`, now);
    expect(r.historyAvailable).toBe(false);
    expect(r.ageDays).toBeNull();
    expect(r.flags).toEqual(["history unavailable: its age and upgrade authority are unknown"]);
  });

  it("doesn't call Sui's own packages young: the network upgrades them in place", async () => {
    for (const id of ["0x2", `0x${"0".repeat(63)}1`, "0x3"]) {
      const r = await riskOf(client, "testnet", id, now);
      expect(r.systemPackage, id).toBe(true);
      expect(r.flags, id).toEqual([]);
    }
  });
});

describe("brief (E9)", () => {
  it("knows private addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("never fetches private or non-http targets", async () => {
    const never = (async () => {
      throw new Error("fetched");
    }) as unknown as typeof fetch;
    await expect(fetchPage("http://127.0.0.1/admin", { fetch: never })).rejects.toMatchObject({
      code: "private_address",
    });
    await expect(
      fetchPage("http://metadata.internal/", {
        fetch: never,
        resolve: async () => ["169.254.169.254"],
      }),
    ).rejects.toMatchObject({ code: "private_address" });
    await expect(fetchPage("file:///etc/passwd", { fetch: never })).rejects.toMatchObject({
      code: "bad_url",
    });
  });

  it("reads a public page as text", async () => {
    const page = (async () =>
      new Response(
        "<html><script>x()</script><p>Hello &amp; welcome.</p></html>",
      )) as unknown as typeof fetch;
    expect(
      await fetchPage("https://example.com", {
        fetch: page,
        resolve: async () => ["93.184.216.34"],
      }),
    ).toBe("Hello & welcome.");
    expect(textOf("<b>a</b>  b")).toBe("a b");
    expect(await firstSentences("One. Two! Three? Four.")).toBe("One. Two! Three?");
  });

  it("rejects an empty or bad request before asking for payment", async () => {
    settled.length = 0;
    const app = createBriefApp({ pay });
    expect((await app.request("/brief")).status).toBe(400);
    expect((await app.request("/brief?url=ftp://x")).status).toBe(400);
    expect(settled).toEqual([]);
  });

  it("summarizes text after payment, with the injected summarizer", async () => {
    const app = createBriefApp({ pay, summarize: async (t) => `• ${t.length} chars` });
    expect((await app.request("/brief?text=hello")).status).toBe(402);
    const res = await app.request("/brief?text=hello%20world", { headers: paidHeader });
    expect(await res.json()).toMatchObject({ summary: "• 11 chars", source: "text" });
  });
});
