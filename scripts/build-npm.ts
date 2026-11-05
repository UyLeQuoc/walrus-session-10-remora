/**
 * ADR-0140: `bun run build:npm` in a publishable package runs tsc into `dist/`, then this script
 * (from the package's folder). It rewrites the built specifiers, writes `dist/package.json` and
 * copies README.md and LICENSE, so `dist/` is the package npm publishes:
 *   bun run --filter @remora/merchant build:npm && npm pack --dry-run ./packages/merchant/dist
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { publishManifest, type RepoManifest, rewriteSpecifiers } from "./npm-package.ts";

type Manifest = RepoManifest & { scripts?: Record<string, string> };

const ROOT = new URL("..", import.meta.url).pathname;
const dir = process.cwd();
const dist = join(dir, "dist");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Manifest;
const KEPT = ["package.json", "README.md", "LICENSE"];

if (!existsSync(dist)) throw new Error(`${dist} is missing: run tsc -p tsconfig.build.json first.`);

const publishable: Record<string, string> = {};
for (const name of readdirSync(join(ROOT, "packages"))) {
  const path = join(ROOT, "packages", name, "package.json");
  if (!existsSync(path)) continue;
  const m = read(path);
  if (m.scripts?.["build:npm"]) publishable[m.name] = m.version;
}

const entries = readdirSync(dist, { withFileTypes: true }).filter((e) => !KEPT.includes(e.name));
for (const e of entries) {
  if (!e.isFile() || !/\.(d\.ts|js)$/.test(e.name)) continue;
  const path = join(dist, e.name);
  writeFileSync(path, rewriteSpecifiers(readFileSync(path, "utf8"), Object.keys(publishable)));
}
const files = [
  ...new Set(
    entries.map((e) =>
      e.isDirectory()
        ? e.name
        : e.name.endsWith(".d.ts")
          ? "*.d.ts"
          : `*${e.name.slice(e.name.lastIndexOf("."))}`,
    ),
  ),
];

const manifest = publishManifest(read(join(dir, "package.json")), {
  publishable,
  files,
  directory: relative(ROOT, dir),
});
writeFileSync(join(dist, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(dir, "README.md"), join(dist, "README.md"));
copyFileSync(join(ROOT, "LICENSE"), join(dist, "LICENSE"));
console.log(`${manifest.name}@${manifest.version} → ${relative(ROOT, dist)} (${files.join(", ")})`);
