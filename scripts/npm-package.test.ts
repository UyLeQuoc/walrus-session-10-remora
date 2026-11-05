// bun test scripts/npm-package.test.ts (the root has no vitest; bun's runner needs no install)
import { describe, expect, it } from "bun:test";
import { NPM_SCOPE, npmName, publishManifest, rewriteSpecifiers } from "./npm-package.ts";

const merchant = {
  name: "@remora/merchant",
  version: "0.1.0",
  description: "Sell a route",
  license: "MIT",
  type: "module",
  exports: { ".": "./src/index.ts" },
  dependencies: { "@mysten/sui": "^2.33.2", "@remora/disc-sdk": "workspace:*", hono: "^4.13.13" },
};

describe("npm packages (ADR-0140)", () => {
  it("names workspace packages under the npm scope and leaves others alone", () => {
    expect(npmName("@remora/disc-sdk")).toBe(`${NPM_SCOPE}/disc-sdk`);
    expect(npmName("create-remora")).toBe("create-remora");
    expect(npmName("hono")).toBe("hono");
  });

  it("publishes built entries and turns workspace dependencies into caret ranges", () => {
    const m = publishManifest(merchant, {
      publishable: { "@remora/disc-sdk": "0.1.0", "@remora/merchant": "0.1.0" },
      files: ["*.js", "*.d.ts"],
      directory: "packages/merchant",
    });
    expect(m).toMatchObject({
      name: `${NPM_SCOPE}/merchant`,
      version: "0.1.0",
      private: false,
      license: "MIT",
      type: "module",
      exports: { ".": { types: "./index.d.ts", import: "./index.js" } },
      files: ["*.d.ts", "*.js"],
      dependencies: {
        "@mysten/sui": "^2.33.2",
        [`${NPM_SCOPE}/disc-sdk`]: "^0.1.0",
        hono: "^4.13.13",
      },
      publishConfig: { access: "public" },
      repository: { directory: "packages/merchant" },
    });
    expect(m).not.toHaveProperty("scripts");
    expect(m).not.toHaveProperty("devDependencies");
    expect(JSON.stringify(m)).not.toContain("workspace:");
  });

  it("maps a bin to its built file", () => {
    const m = publishManifest(
      { name: "create-remora", version: "0.1.0", bin: { "create-remora": "./src/cli.ts" } },
      { publishable: {}, files: ["*.js", "template"], directory: "packages/create-remora" },
    );
    expect(m).toMatchObject({ name: "create-remora", bin: { "create-remora": "./cli.js" } });
    expect(m).not.toHaveProperty("exports");
  });

  it("refuses a workspace dependency that doesn't publish", () => {
    expect(() =>
      publishManifest(
        { ...merchant, dependencies: { "@remora/schema": "workspace:*" } },
        { publishable: {}, files: [], directory: "packages/merchant" },
      ),
    ).toThrow(/@remora\/schema, which doesn't publish/);
  });

  it("rewrites relative .ts specifiers and publishable package names in built code", () => {
    const built = [
      'export * from "./bcs.ts";',
      "import { a } from '../x/y.ts';",
      'import "./side.ts";',
      'type T = import("./fetch.ts").DiscFetchOptions;',
      'import type { DiscConfig } from "@remora/disc-sdk";',
      'import { z } from "@remora/schema";',
      'const label = "a .ts file";',
      'export const MERCHANT = { workspace: "@remora/disc-sdk" };',
    ].join("\n");
    expect(rewriteSpecifiers(built, ["@remora/disc-sdk"])).toBe(
      [
        'export * from "./bcs.js";',
        "import { a } from '../x/y.js';",
        'import "./side.js";',
        'type T = import("./fetch.js").DiscFetchOptions;',
        `import type { DiscConfig } from "${NPM_SCOPE}/disc-sdk";`,
        'import { z } from "@remora/schema";',
        'const label = "a .ts file";',
        'export const MERCHANT = { workspace: "@remora/disc-sdk" };',
      ].join("\n"),
    );
  });
});
