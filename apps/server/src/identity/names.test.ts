import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { guestCookie, legacyGuestOnly, sessionCookie, sessionHeader } from "./names.ts";

describe("identity names (ADR-0044)", () => {
  const app = new Hono().get("/", (c) =>
    c.json({
      session: sessionCookie(c) ?? sessionHeader(c) ?? null,
      guest: guestCookie(c) ?? null,
      move: legacyGuestOnly(c),
    }),
  );
  const read = async (headers: Record<string, string>) =>
    (await app.request("/", { headers })).json();

  it("reads the Remora names first and still accepts the hippo ones", async () => {
    expect(await read({ cookie: "remora_session=new; hippo_session=old" })).toMatchObject({
      session: "new",
    });
    expect(await read({ cookie: "hippo_session=old" })).toMatchObject({ session: "old" });
    expect(await read({ "x-hippo-session": "hdr" })).toMatchObject({ session: "hdr" });
    expect(await read({ "x-remora-session": "hdr2" })).toMatchObject({ session: "hdr2" });
  });

  it("moves a guest still on the hippo cookie", async () => {
    expect(await read({ cookie: "hippo_guest=g1" })).toEqual({
      session: null,
      guest: "g1",
      move: true,
    });
    expect(await read({ cookie: "remora_guest=g2; hippo_guest=g1" })).toMatchObject({
      guest: "g2",
      move: false,
    });
  });
});
