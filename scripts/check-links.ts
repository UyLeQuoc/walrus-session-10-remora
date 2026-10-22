/**
 * L2: fails when a relative link in README.md or docs/ (or a package README) points at a file that
 * doesn't exist. External links and anchors aren't checked here.
 *   bun scripts/check-links.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

function markdown(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (
      [
        "node_modules",
        ".git",
        "reference",
        "dist",
        "build",
        "test-results",
        "playwright-report",
      ].includes(name)
    )
      continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...markdown(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const docs = [
  join(ROOT, "README.md"),
  ...markdown(join(ROOT, "docs")),
  ...["apps", "packages"].flatMap((d) => markdown(join(ROOT, d))),
];
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const broken: string[] = [];
let checked = 0;
for (const file of docs) {
  // Code blocks can hold example links; skip fenced blocks.
  const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const m of text.matchAll(LINK)) {
    const target = m[1] ?? "";
    if (/^(https?:|mailto:|tel:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0] ?? "");
    if (!path) continue;
    checked++;
    if (!existsSync(join(dirname(file), path))) broken.push(`${relative(ROOT, file)} → ${target}`);
  }
}
if (broken.length) {
  console.error(`${broken.length} broken link(s):\n${broken.map((b) => `  ${b}`).join("\n")}`);
  process.exit(1);
}
console.log(`${checked} relative links in ${docs.length} files resolve.`);
