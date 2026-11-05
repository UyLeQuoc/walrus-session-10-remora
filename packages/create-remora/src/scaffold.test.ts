import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { npmName } from "../../../scripts/npm-package.ts";
import {
  fill,
  MERCHANT,
  nextSteps,
  outputPath,
  packageManager,
  packageName,
  REEF_LISTING_URL,
  scaffold,
  scaffoldManifest,
} from "./scaffold.ts";

const here = (p: string) => new URL(p, import.meta.url).pathname;
const TEMPLATE = here("../template/");
const EXAMPLE = here("../../../examples/sell-an-api/");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;

let cwd = "";
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "create-remora-"));
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

describe("create-remora (ADR-0140)", () => {
  it("scaffolds a standalone paid API that depends on the published merchant", () => {
    const made = scaffold({ target: "my-api", templateDir: TEMPLATE, cwd });
    expect(made).toMatchObject({ ok: true, name: "my-api", dir: join(cwd, "my-api") });
    if (!made.ok) return;
    expect(made.files).toEqual([
      ".env.example",
      ".gitignore",
      "README.md",
      "package.json",
      "src/app.test.ts",
      "src/app.ts",
      "src/main.ts",
      "src/sui.ts",
      "tsconfig.json",
    ]);
    const pkg = json(join(made.dir, "package.json"));
    expect(pkg).toMatchObject({ name: "my-api", private: true, type: "module" });
    expect(pkg.dependencies).toMatchObject({ "@getremora/merchant": "^0.1.0", hono: "^4.13.13" });
    for (const file of made.files) {
      const text = readFileSync(join(made.dir, file), "utf8");
      expect(text, file).not.toMatch(/workspace:|@remora\//);
    }
    const app = readFileSync(join(made.dir, "src/app.ts"), "utf8");
    expect(app).toContain('from "@getremora/merchant"');
    const readme = readFileSync(join(made.dir, "README.md"), "utf8");
    expect(readme).toMatch(/^# my-api\n/);
    expect(readme).toContain("## List it on the Reef");
    expect(readme).toContain(REEF_LISTING_URL);
    expect(readFileSync(join(made.dir, ".env.example"), "utf8")).toMatch(/^PAY_TO=$/m);
  });

  it("refuses a folder that isn't empty and leaves it as it was", () => {
    mkdirSync(join(cwd, "taken"));
    writeFileSync(join(cwd, "taken", "notes.txt"), "mine");
    const made = scaffold({ target: "taken", templateDir: TEMPLATE, cwd });
    expect(made).toEqual({
      ok: false,
      reason: "taken already exists and isn't empty: pick a new folder.",
    });
    expect(readFileSync(join(cwd, "taken", "notes.txt"), "utf8")).toBe("mine");
    writeFileSync(join(cwd, "a-file"), "x");
    expect(scaffold({ target: "a-file", templateDir: TEMPLATE, cwd }).ok).toBe(false);
  });

  it("fills an empty folder, and refuses a name npm wouldn't take", () => {
    mkdirSync(join(cwd, "empty"));
    expect(scaffold({ target: "empty", templateDir: TEMPLATE, cwd }).ok).toBe(true);
    const bad = scaffold({ target: "My API", templateDir: TEMPLATE, cwd });
    expect(bad).toMatchObject({ ok: false, reason: expect.stringMatching(/npm package name/) });
    expect(packageName("/x/haiku-shop.v2")).toBe("haiku-shop.v2");
    expect(packageName("/x/.hidden")).toBeNull();
    expect(packageName("/x/Caps")).toBeNull();
  });

  it("keeps the example's API and test word for word", () => {
    for (const file of ["src/app.ts", "src/app.test.ts"])
      expect(readFileSync(join(TEMPLATE, file), "utf8"), file).toBe(
        readFileSync(join(EXAMPLE, file), "utf8"),
      );
  });

  it("names the merchant as it publishes, at its version, and the example's dependency ranges", () => {
    const merchant = json(here("../../merchant/package.json"));
    expect(MERCHANT.name).toBe(npmName(MERCHANT.workspace));
    expect(MERCHANT.range).toBe(`^${merchant.version}`);
    const repo = {
      ...(json(join(EXAMPLE, "package.json")).dependencies as Record<string, string>),
      ...(json(join(EXAMPLE, "package.json")).devDependencies as Record<string, string>),
      ...(json(here("../../chain/package.json")).dependencies as Record<string, string>),
    };
    const manifest = scaffoldManifest("x");
    const ours = {
      ...(manifest.dependencies as Record<string, string>),
      ...(manifest.devDependencies as Record<string, string>),
    };
    for (const [dep, range] of Object.entries(ours))
      if (repo[dep]) expect(range, dep).toBe(repo[dep]);
  });

  it("renames dotfiles and fills the name", () => {
    expect(outputPath("gitignore")).toBe(".gitignore");
    expect(outputPath("env.example")).toBe(".env.example");
    expect(outputPath("src/app.ts")).toBe("src/app.ts");
    expect(fill('# {{name}}\nimport { x402 } from "@remora/merchant";', "shop")).toBe(
      '# shop\nimport { x402 } from "@getremora/merchant";',
    );
  });

  it("prints the next steps in the caller's package manager", () => {
    expect(packageManager("bun/1.3.14 npm/? node/v24.3.0 darwin arm64")).toBe("bun");
    expect(packageManager("pnpm/10.0.0 npm/? node/v24.3.0")).toBe("pnpm");
    expect(packageManager("npm/11.0.0 node/v24.3.0")).toBe("npm");
    expect(packageManager(undefined)).toBe("npm");
    const steps = nextSteps({ dir: join(cwd, "my-api"), name: "my-api", cwd, pm: "bun" });
    expect(steps).toContain("  cd my-api\n  bun install\n");
    expect(steps).toContain("  bun run start\n");
    expect(steps).toContain(REEF_LISTING_URL);
    expect(nextSteps({ dir: cwd, name: "x", cwd, pm: "npm" })).not.toContain("cd ");
  });
});
