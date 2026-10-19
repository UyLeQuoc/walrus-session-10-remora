import { describe, expect, it } from "vitest";
import { navActive } from "./nav-active";

const NAV = ["/", "/approvals", "/funds", "/memory"];

describe("navActive", () => {
  it("keeps Home lit on the dashboard routes and nowhere else", () => {
    for (const p of ["/", "/remoras", "/remoras/new", "/remoras/abc-123"]) {
      expect(navActive("/", p), p).toBe(true);
    }
    for (const p of ["/funds", "/approvals", "/memory", "/chat", "/settings", "/verify"]) {
      expect(navActive("/", p), p).toBe(false);
    }
  });

  it("matches every other item on its own path and subpaths, but not on a lookalike", () => {
    expect(navActive("/funds", "/funds")).toBe(true);
    expect(navActive("/funds", "/funds/other")).toBe(true);
    expect(navActive("/approvals", "/approvals")).toBe(true);
    expect(navActive("/memory", "/memory")).toBe(true);
    expect(navActive("/funds", "/funding")).toBe(false);
    expect(navActive("/memory", "/memories")).toBe(false);
  });

  it("lights at most one item per route", () => {
    for (const p of [
      "/",
      "/remoras",
      "/remoras/new",
      "/funds",
      "/approvals",
      "/memory",
      "/chat",
      "/settings",
      "/verify",
    ]) {
      const lit = NAV.filter((to) => navActive(to, p));
      expect(lit.length, `${p} lit ${lit.join(", ")}`).toBeLessThanOrEqual(1);
    }
    expect(NAV.filter((to) => navActive(to, "/remoras/new"))).toEqual(["/"]);
    expect(NAV.filter((to) => navActive(to, "/chat"))).toEqual([]);
  });
});
