import { describe, expect, it } from "vitest";
import { createFacilitatorRoutes } from "./facilitator.ts";

const UP = "http://fac.local";
function world(limits = { settlesPerPayToPerDay: 2, gasPerIpPerMinute: 2 }) {
  const calls: string[] = [];
  let t = Date.UTC(2026, 10, 5, 3);
  const app = createFacilitatorRoutes({
    upstream: () => UP,
    now: () => t,
    limits,
    fetch: (async (input: string | URL | Request) => {
      calls.push(new URL(String(input)).pathname);
      return Response.json({ ok: true, path: new URL(String(input)).pathname });
    }) as typeof fetch,
  });
  const post = (path: string, body: unknown, ip = "10.0.0.1") =>
    app.request(`/api/facilitator/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });
  return { app, calls, post, later: (ms: number) => (t += ms) };
}
const pay = (payTo: string, network = "sui:testnet") => ({
  paymentPayload: { network, payload: {} },
  paymentRequirements: { network, payTo, amount: "5000" },
});

describe("the public facilitator (E13, ADR-0111)", () => {
  it("describes itself, and forwards supported, verify and settle to the facilitator", async () => {
    const w = world();
    const about = (await (await w.app.request("/api/facilitator")).json()) as {
      network: string;
    };
    expect(about.network).toBe("sui:testnet");
    expect((await w.app.request("/api/facilitator/supported")).status).toBe(200);
    expect((await w.post("verify", pay("0xa"))).status).toBe(200);
    expect((await w.post("settle", pay("0xa"))).status).toBe(200);
    expect(w.calls).toEqual(["/supported", "/verify", "/settle"]);
  });

  it("is testnet only", async () => {
    const w = world();
    expect((await w.post("verify", pay("0xa", "sui:mainnet"))).status).toBe(400);
    expect((await w.post("gas", { network: "sui:mainnet" })).status).toBe(400);
    expect(w.calls).toEqual([]);
  });

  it("caps settlements per payTo per day, which caps the gas it sponsors for one merchant", async () => {
    const w = world();
    expect((await w.post("settle", pay("0xA"))).status).toBe(200);
    expect((await w.post("settle", pay("0xa"))).status).toBe(200);
    const third = await w.post("settle", pay("0xa"));
    expect(third.status).toBe(429);
    expect(((await third.json()) as { error: { code: string } }).error.code).toBe(
      "facilitator.daily_cap",
    );
    // Another merchant has its own cap, and the next UTC day starts over.
    expect((await w.post("settle", pay("0xb"))).status).toBe(200);
    w.later(24 * 60 * 60_000);
    expect((await w.post("settle", pay("0xa"))).status).toBe(200);
  });

  it("limits gas-station calls per address per minute (each holds a sponsor coin)", async () => {
    const w = world();
    const gas = { network: "sui:testnet", sender: "0x1", transactionKind: "AA==" };
    expect((await w.post("gas", gas)).status).toBe(200);
    expect((await w.post("gas", gas)).status).toBe(200);
    expect((await w.post("gas", gas)).status).toBe(429);
    expect((await w.post("gas", gas, "10.0.0.2")).status).toBe(200);
    w.later(61_000);
    expect((await w.post("gas", gas)).status).toBe(200);
  });
});
