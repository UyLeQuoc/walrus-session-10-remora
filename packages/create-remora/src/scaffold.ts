/**
 * ADR-0140: `create-remora` copies `template/` (examples/sell-an-api, standalone) into a new folder
 * and writes its package.json with the published `@remora/merchant`, under its npm name.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

/** The paid door, as it's published on npm (the workspace calls it `@remora/merchant`). */
export const MERCHANT = {
  workspace: "@remora/merchant",
  name: "@getremora/merchant",
  range: "^0.1.0",
};

export const REEF_LISTING_URL = "https://getremora.vercel.app/reef/new";

const DEPENDENCIES: Record<string, string> = {
  "@grpc/grpc-js": "^1.14.6",
  "@hono/node-server": "^2.1.5",
  "@mysten/sui": "^2.33.2",
  "@protobuf-ts/grpc-transport": "^2.11.1",
  hono: "^4.13.13",
};

const DEV_DEPENDENCIES: Record<string, string> = {
  "@types/node": "^24.0.0",
  tsx: "^4.21.0",
  typescript: "^5.9.3",
  vitest: "^4.1.12",
};

/** npm drops `.gitignore` from a tarball, so dotfiles are stored without the dot. */
const DOTFILES: Record<string, string> = { gitignore: ".gitignore", "env.example": ".env.example" };

export type PackageManager = "npm" | "bun" | "pnpm" | "yarn";

export type ScaffoldResult =
  | { ok: true; dir: string; name: string; files: string[] }
  | { ok: false; reason: string };

/** The folder's name, if npm takes it as a package name. */
export function packageName(dir: string): string | null {
  const name = basename(dir);
  return name.length <= 214 && /^[a-z0-9][a-z0-9._-]*$/.test(name) ? name : null;
}

export function scaffoldManifest(name: string): Record<string, unknown> {
  const dependencies = { ...DEPENDENCIES, [MERCHANT.name]: MERCHANT.range };
  return {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    engines: { node: ">=20.12" },
    scripts: {
      start: "tsx src/main.ts",
      dev: "tsx watch src/main.ts",
      test: "vitest run",
      typecheck: "tsc -p tsconfig.json",
    },
    dependencies: Object.fromEntries(
      Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b)),
    ),
    devDependencies: DEV_DEPENDENCIES,
  };
}

/** A template file as the new project gets it: its name, and the merchant under its npm name. */
export function fill(text: string, name: string): string {
  return text.replaceAll("{{name}}", name).replaceAll(MERCHANT.workspace, MERCHANT.name);
}

export function outputPath(templatePath: string): string {
  const base = basename(templatePath);
  const dotted = DOTFILES[base];
  return dotted ? join(dirname(templatePath), dotted) : templatePath;
}

function templateFiles(dir: string, under = ""): string[] {
  return readdirSync(join(dir, under), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? templateFiles(dir, join(under, e.name)) : [join(under, e.name)],
  );
}

export function scaffold(o: { target: string; templateDir: string; cwd: string }): ScaffoldResult {
  const dir = resolve(o.cwd, o.target);
  const name = packageName(dir);
  if (!name)
    return {
      ok: false,
      reason: `"${basename(dir)}" can't be an npm package name: use lowercase letters, digits, "-", "." or "_".`,
    };
  if (existsSync(dir) && (!statSync(dir).isDirectory() || readdirSync(dir).length > 0))
    return { ok: false, reason: `${o.target} already exists and isn't empty: pick a new folder.` };

  const files = templateFiles(o.templateDir);
  for (const file of files) {
    const out = join(dir, outputPath(file));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, fill(readFileSync(join(o.templateDir, file), "utf8"), name));
  }
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(scaffoldManifest(name), null, 2)}\n`);
  return { ok: true, dir, name, files: [...files.map(outputPath), "package.json"].sort() };
}

/** From `npm_config_user_agent`, e.g. `bun/1.3.14 npm/? node/v24.3.0 darwin arm64`. */
export function packageManager(userAgent: string | undefined): PackageManager {
  const tool = userAgent?.split("/")[0];
  return tool === "bun" || tool === "pnpm" || tool === "yarn" ? tool : "npm";
}

export function nextSteps(o: {
  dir: string;
  name: string;
  cwd: string;
  pm: PackageManager;
}): string {
  const cd = relative(o.cwd, o.dir);
  const run = o.pm === "bun" ? "bun run start" : `${o.pm} start`;
  return [
    `Created ${o.name}: an API that remoras, and any x402 or MPP client, pay in USDC on Sui testnet.`,
    "",
    ...(cd ? [`  cd ${cd}`] : []),
    `  ${o.pm} install`,
    "  cp .env.example .env    # set PAY_TO to the Sui address that gets paid",
    `  ${run}`,
    "",
    `Then put it on a public https URL and list it on the Reef: ${REEF_LISTING_URL}`,
  ].join("\n");
}
