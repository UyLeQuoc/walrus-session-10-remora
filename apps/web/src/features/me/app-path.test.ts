import { describe, expect, it } from "vitest";
import { appPath } from "@/features/me/app-path";

const origin = "http://localhost:5173";

describe("appPath", () => {
  it("keeps a same-origin connect link inside the app", () => {
    expect(appPath(`${origin}/connect/abc`, origin)).toBe("/connect/abc");
  });

  it("leaves another host for a full navigation", () => {
    expect(appPath("https://hippo.example/connect/abc", origin)).toBeNull();
  });
});
