import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANNEL_COMMANDS } from "./command-catalog.ts";

describe("CHANNEL_COMMANDS", () => {
  it("is exactly what the Slack manifest registers", () => {
    const manifest = readFileSync(
      new URL("../../../docs/slack-manifest.yaml", import.meta.url),
      "utf8",
    );
    const registered = [...manifest.matchAll(/- command: \/([a-z]+)/g)].map((m) => m[1]);
    expect(registered).toEqual(CHANNEL_COMMANDS.map((c) => c.name));
  });
});
