/**
 * I3 and M7 (ADR-0079): every poisoned template in evals/template-attacks.json goes to the Hatchery's
 * safety review before publish. Each must be blocked by its deterministic check.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TeamFile } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { reviewTemplate } from "./safety.ts";

interface Attack {
  id: string;
  name: string;
  remora: Record<string, unknown>;
  expect: { codes: string[] };
}

const suite = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../../../evals/template-attacks.json"), "utf8"),
) as { attacks: Attack[] };

const REEF = ["reef:sui-risk", "reef:odds", "reef:brief"];

describe(`template attacks (${suite.attacks.length})`, () => {
  const published: string[] = [];

  it.each(suite.attacks.map((a) => [`${a.id}: ${a.name}`, a] as const))("%s", async (_n, a) => {
    const team = TeamFile.parse({ schema: "remora.team/v1", name: "Shared", remoras: [a.remora] });
    const markdown = `---\n${JSON.stringify(team)}\n---\n\n# ${team.name}\n`;
    const report = await reviewTemplate({ team, markdown, reef: REEF });
    if (report.verdict !== "block") published.push(a.id);
    expect(report.verdict).toBe("block");
    expect(report.findings.map((f) => f.code)).toEqual(expect.arrayContaining(a.expect.codes));
  });

  it("published nothing", () => {
    expect(published).toEqual([]);
    console.log(`${suite.attacks.length} template attacks, 0 published`);
  });
});
