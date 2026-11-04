import { describe, expect, it } from "vitest";
import { parseTeamMarkdown } from "../runtime/teams.ts";
import { privateReason, reviewTemplate } from "./safety.ts";

const REEF = [
  "reef:sui-risk",
  "reef:odds",
  "reef:brief",
  "reef:wallet",
  "reef:walrus",
  "reef:github",
  "reef:price",
  "reef:weather",
];
const file = (pack: string[]) => `---
schema: remora.team/v1
name: Package auditor
remoras:
  - template: scout
    name: Package auditor
pack:
${pack.map((p) => `  - ${JSON.stringify(p)}`).join("\n")}
---

Checks packages.
`;

describe("starter memory packs (M2)", () => {
  it("keeps people, handles, emails, phones and private links out", () => {
    expect(
      privateReason("SOURCE reef:sui-risk · 4 calls · 3 useful · $0.013 per useful answer"),
    ).toBeNull();
    expect(privateReason("PRICE reef:price · usually 0.005 USDC a charge")).toBeNull();
    expect(privateReason("CONTACT Linh · paid 2.00 USDC for lunch")).toBe(
      "it's about a person you pay",
    );
    expect(privateReason("ask me at linh@example.com")).toBe("it has an email address");
    expect(privateReason("ping @linh_t on telegram")).toBe("it has a handle");
    expect(privateReason("call +84 912 345 678")).toBe("it has a phone number");
    expect(privateReason("see https://x.test/a?token=abc")).toBe("it has a link with parameters");
    expect(privateReason(`watch 0x${"ab".repeat(32)}`)).toBe("it names a raw address");
  });

  it("parses a pack from the file, and the review blocks a private line", async () => {
    const clean = file(["SOURCE reef:sui-risk · 4 calls · 3 useful"]);
    const { team } = parseTeamMarkdown(clean);
    expect(team.pack).toEqual(["SOURCE reef:sui-risk · 4 calls · 3 useful"]);
    expect((await reviewTemplate({ team, markdown: clean, reef: REEF })).verdict).not.toBe("block");
    const leaky = file(["CONTACT Linh · paid 2 USDC"]);
    const report = await reviewTemplate({
      team: parseTeamMarkdown(leaky).team,
      markdown: leaky,
      reef: REEF,
    });
    expect(report.verdict).toBe("block");
    expect(report.findings).toContainEqual(
      expect.objectContaining({ code: "private_memory", where: "pack[0]" }),
    );
  });
});
