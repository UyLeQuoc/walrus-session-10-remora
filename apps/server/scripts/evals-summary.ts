/**
 * I3 (ADR-0079): `bun run evals` prints this after the three attack suites pass. It counts the attacks
 * in evals/*.json by the layer that stops them; the suites have already checked that nothing paid.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../../evals");
const read = (f: string) =>
  JSON.parse(readFileSync(resolve(root, f), "utf8")) as {
    attacks: { expect: { layer?: string; verdict?: string; codes?: string[] } }[];
  };

const rows: [string, string, number][] = [];
const tally = (suite: string, layerOf: (e: { layer?: string; verdict?: string }) => string) => {
  const counts = new Map<string, number>();
  for (const a of read(suite).attacks) {
    const layer = layerOf(a.expect);
    counts.set(layer, (counts.get(layer) ?? 0) + 1);
  }
  for (const [layer, n] of counts) rows.push([suite.replace(/\.json$/, ""), layer, n]);
};
tally("mcp-attacks.json", (e) => e.layer ?? "?");
tally("payment-attacks.json", (e) =>
  e.verdict === "ask" ? "Sonar: asks the owner" : "Sonar: blocks",
);
tally("template-attacks.json", () => "Hatchery safety review: blocks");

const total = rows.reduce((s, [, , n]) => s + n, 0);
console.log("\n| Suite | Stopped by | Attacks |\n|---|---|---|");
for (const [suite, layer, n] of rows) console.log(`| ${suite} | ${layer} | ${n} |`);
console.log(`\n${total} attacks, 0 overspends.`);
