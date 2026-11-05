# ADR-0140: `create-remora` scaffolds a paid API, and the Disc SDK and the merchant build to npm packages under `@getremora`

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
U19's D4 ([spec](../goals/uy-19-it-gets-better.md#d4-create-remora-and-publishable-packages-j1-j2))
asks for:
- `bunx create-remora my-api` (or `npx`), which scaffolds a paid API from
  [examples/sell-an-api](../../examples/sell-an-api);
- `@remora/disc-sdk` and `@remora/merchant` that npm can publish.

What we found on Nov 5:
- **The workspace imports source.** Both packages export `./src/index.ts`. The server, the
  facilitator and the merchants run on `tsx`, the web app on Vite, the tests on Vitest, and every
  package typechecks with `tsc`.
  - Pointing `exports` at `dist` would need a build before every dev run, test and deploy.
  - A custom export condition would need a flag in each of those tools.
- **npm can't take the source manifest as it is.**
  - npm keeps `workspace:*` literally, so it would not resolve.
  - npm ignores `publishConfig.exports`.
- **tsc rewrites `.ts` specifiers in JavaScript but not in declarations** (with
  `rewriteRelativeImportExtensions`).
- **The Disc SDK's declarations name `@mysten/bcs`.** `AllowanceBcs`'s inferred type uses a type
  that `@mysten/sui/bcs` doesn't re-export. Bun's isolated installs don't link `@mysten/bcs` into
  the package, so tsc refuses to emit it.
- **npm's `@remora` scope is taken.** `registry.npmjs.org/-/org/remora/package` answers `{}`, an
  existing scope with no public packages. `@getremora` answers "Scope not found", and
  `create-remora` is unpublished.
- **The example imports `@remora/chain`** for its gRPC client, which pulls Tatum, logging and the
  fallback with it.

## Decision
- **`dist/` is the npm package.** Each publishable package gets a `build:npm` script:
  - `tsc -p tsconfig.build.json` builds into `dist/`, without tests;
  - then [`scripts/build-npm.ts`](../../scripts/build-npm.ts) rewrites the built specifiers
    (`./x.ts` becomes `./x.js`, and `@remora/<pkg>` takes its npm name) and writes
    `dist/package.json`. That manifest has `private: false`, a version, `exports` (`types` and
    `import`), `files`, the MIT license, `publishConfig.access: public`, and no scripts or
    devDependencies;
  - it copies the README and the root LICENSE into `dist/`.

  The pure part is [`scripts/npm-package.ts`](../../scripts/npm-package.ts), tested with `bun test`.
- **The repo's manifests don't change how the workspace resolves.** They keep `exports` at `src`
  and `"private": true`, so nobody can publish the source manifest by mistake.
  - The script is named `build:npm`, not `build`, so `turbo run build` (Vercel, Railway) never runs
    it.
- **A `workspace:` dependency must publish too.** It becomes `^<its version>` under its npm name.
  - A package that doesn't publish stops the build with a message to give it `build:npm` or
    bundle it.
  - The merchant depends only on the Disc SDK, which publishes, so nothing is bundled and
    `@remora/schema` stays private.
- **npm names:** `@getremora/disc-sdk` 0.1.0, `@getremora/merchant` 0.1.0 and `create-remora` 0.1.0.
  - `NPM_SCOPE` in `scripts/npm-package.ts` and `MERCHANT` in create-remora's `scaffold.ts` name
    the scope. A test keeps the two in step.
  - The workspace keeps the name `@remora/*`.
- **`@mysten/bcs` ^2.1.2 becomes a direct dependency of the Disc SDK,** because its published types
  name it. It's the version `@mysten/sui` already brings, so it adds no new third-party package.
- **`packages/create-remora`** has a `bin`, and Node built-ins only:
  - it copies `template/` into a new or empty folder (it refuses any other) and writes a
    `package.json` that depends on `@getremora/merchant ^0.1.0`;
  - the template's `src/app.ts` and `src/app.test.ts` are the example's, word for word (a test
    checks);
  - `src/main.ts` loads `.env`, and `src/sui.ts` replaces `@remora/chain` with ten lines of the
    public fullnode over native gRPC;
  - it adds a `.env.example`, and a README that ends with how to list the API on the Reef;
  - dotfiles are stored without the dot, because npm drops `.gitignore`.
- **Publishing is Uy's.** No package went to npm in U19's run.

## Consequences
- **Exit check (Nov 5, testnet).** The steps:
  1. we packed all three tarballs and ran `npx --package=<create-remora tarball> create-remora my-api`;
  2. we pointed the merchant and the Disc SDK at the tarballs and ran `npm install`; typecheck
     and the tests passed (4 of 4);
  3. we started the API on port 8900; an unpaid GET answered 402 with x402's requirements and an
     MPP challenge;
  4. the packed `@getremora/disc-sdk`'s `discFetch` paid it through a Disc that the burner issued
     for a fresh key: settle `62JxpmN4pAuXBhd1mvLCfRRVJAX5f5m5zARszsGBQ7AW`, 0.005 USDC to the
     second burner. The Disc was revoked afterwards.
- **A source change reaches npm only through a new version.** A release means: bump the version,
  run `build:npm`, then publish.
- **Uy publishes in this order:**
  1. create the npm org `getremora`;
  2. publish the Disc SDK, then the merchant, then `create-remora`
     ([create-remora's README](../../packages/create-remora/README.md)).
- **`npx create-remora` installs nothing until both packages are on npm.**

## Links
- [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md) (goal U19), [ADR-0111](0111-scale-pass.md)
  (the public facilitator), [ADR-0113](0113-community-listings-and-public-facilitator.md) (listing on
  the Reef), [ADR-0120](0120-mpp-on-every-door.md) (MPP), [ADR-0021](0021-sui-grpc-only.md) (gRPC only)
