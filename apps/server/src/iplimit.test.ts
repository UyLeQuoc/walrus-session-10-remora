/**
 * The limit a caller cannot opt out of.
 *
 * The per-person throttle keys on an id the browser invents, so a loop sending
 * a fresh UUID each time gets an unlimited budget. This is the ceiling above
 * it, and these assert the properties that make it one.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  checkAddress,
  clientAddress,
  isUnmetered,
  refusal,
  resetAddressLimits,
} from "./iplimit.ts";

const start = 1_700_000_000_000;

describe("the per-address ceiling", () => {
  beforeEach(resetAddressLimits);

  it("lets an ordinary visitor through", () => {
    for (let i = 0; i < 25; i++) {
      expect(checkAddress("1.2.3.4", start + i * 1000).allowed).toBe(true);
    }
  });

  it("stops a burst from one address", () => {
    for (let i = 0; i < 30; i++) checkAddress("1.2.3.4", start + i);
    const blocked = checkAddress("1.2.3.4", start + 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not punish anyone else for it", () => {
    for (let i = 0; i < 40; i++) checkAddress("1.2.3.4", start + i);
    expect(checkAddress("5.6.7.8", start + 41).allowed).toBe(true);
  });

  it("forgets a minute later, so a real person is not locked out", () => {
    for (let i = 0; i < 30; i++) checkAddress("1.2.3.4", start + i);
    expect(checkAddress("1.2.3.4", start + 30).allowed).toBe(false);
    expect(checkAddress("1.2.3.4", start + 61_000).allowed).toBe(true);
  });

  it("still holds an hourly ceiling once the minutes are spread out", () => {
    // 200 requests, one every ten seconds: never trips the per-minute rule.
    for (let i = 0; i < 200; i++) checkAddress("9.9.9.9", start + i * 10_000);
    expect(checkAddress("9.9.9.9", start + 200 * 10_000).allowed).toBe(false);
  });

  it("reads the client from the proxy header, not the socket", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(clientAddress(headers)).toBe("203.0.113.7");
    expect(clientAddress(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientAddress(new Headers())).toBe("unknown");
  });
});

describe("isUnmetered", () => {
  it("lets the page read who you are without spending the ceiling", () => {
    expect(isUnmetered("GET", "/api/me")).toBe(true);
    expect(isUnmetered("GET", "/api/me/memories")).toBe(true);
    expect(isUnmetered("GET", "/api/me/memories/11111111-1111-4111-8111-111111111111/status")).toBe(
      true,
    );
    expect(isUnmetered("GET", "/api/conversations")).toBe(true);
    expect(isUnmetered("GET", "/api/conversations/x/messages")).toBe(true);
    expect(isUnmetered("GET", "/api/conversations/x/memories")).toBe(false);
    expect(isUnmetered("GET", "/api/health")).toBe(true);
  });

  it("still counts search, export, and anything that writes", () => {
    expect(isUnmetered("GET", "/api/me/search")).toBe(false);
    expect(isUnmetered("GET", "/api/me/export")).toBe(false);
    expect(isUnmetered("POST", "/api/me")).toBe(false);
    expect(isUnmetered("POST", "/api/me/memories")).toBe(false);
    expect(isUnmetered("POST", "/api/me/memory")).toBe(false);
    expect(isUnmetered("POST", "/api/chat")).toBe(false);
    expect(isUnmetered("DELETE", "/api/conversations/x")).toBe(false);
  });
});

describe("refusal", () => {
  it("gives the chat route a sentence, since its client shows the body as the error", () => {
    // It used to be JSON, which the web chat showed as a raw {"command":true,…} toast.
    const out = refusal("/api/chat", "Slow down a little.");
    expect(out.contentType).toContain("text/plain");
    expect(out.body).toBe("Slow down a little.");
  });

  it("keeps { error } for the pages, which read it", () => {
    const out = refusal("/api/me/export", "Slow down a little.");
    expect(JSON.parse(out.body)).toEqual({ error: "Slow down a little." });
  });
});
