/**
 * ADR-0140: what `scripts/build-npm.ts` writes into a package's `dist/` so npm can publish it. The
 * workspace keeps importing `src` through the repo's package.json; only `dist/package.json` points
 * at the built files, under the npm scope.
 */

/** npm's `@remora` scope is already taken (it exists, with no public packages), so they publish here. */
export const NPM_SCOPE = "@getremora";
const WORKSPACE_SCOPE = "@remora/";
const REPOSITORY = "https://github.com/UyLeQuoc/walrus-session-10-remora";
const HOMEPAGE = "https://getremora.vercel.app";

export interface RepoManifest {
  name: string;
  version: string;
  description?: string;
  license?: string;
  type?: string;
  keywords?: string[];
  engines?: Record<string, string>;
  exports?: Record<string, string>;
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
}

export function npmName(name: string): string {
  return name.startsWith(WORKSPACE_SCOPE)
    ? `${NPM_SCOPE}/${name.slice(WORKSPACE_SCOPE.length)}`
    : name;
}

function built(entry: string, extension: ".js" | ".d.ts"): string {
  const match = /^\.\/src\/(.+)\.ts$/.exec(entry);
  if (!match) throw new Error(`${entry} is not a ./src/*.ts entry.`);
  return `./${match[1]}${extension}`;
}

function mapValues(o: Record<string, string>, f: (v: string) => unknown) {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
}

/**
 * The published manifest: built entries instead of `src`, each `workspace:` dependency as a caret
 * range of a package that publishes too, and no scripts or devDependencies.
 */
export function publishManifest(
  pkg: RepoManifest,
  o: {
    /** Workspace packages that publish (they have a `build:npm` script), with their versions. */
    publishable: Record<string, string>;
    /** What `dist/` holds besides package.json, README.md and LICENSE. */
    files: string[];
    /** The package's folder in the repo, e.g. `packages/merchant`. */
    directory: string;
  },
): Record<string, unknown> {
  const dependencies = mapEntries(pkg.dependencies ?? {}, (name, range) => {
    if (!range.startsWith("workspace:")) return [name, range];
    const version = o.publishable[name];
    if (!version)
      throw new Error(
        `${pkg.name} depends on ${name}, which doesn't publish: give it a build:npm script or bundle it.`,
      );
    return [npmName(name), `^${version}`];
  });
  return {
    name: npmName(pkg.name),
    version: pkg.version,
    private: false,
    ...(pkg.description ? { description: pkg.description } : {}),
    license: pkg.license ?? "MIT",
    ...(pkg.keywords ? { keywords: pkg.keywords } : {}),
    homepage: HOMEPAGE,
    repository: { type: "git", url: `git+${REPOSITORY}.git`, directory: o.directory },
    type: pkg.type ?? "module",
    ...(pkg.exports
      ? {
          exports: mapValues(pkg.exports, (entry) => ({
            types: built(entry, ".d.ts"),
            import: built(entry, ".js"),
          })),
        }
      : {}),
    ...(pkg.bin ? { bin: mapValues(pkg.bin, (entry) => built(entry, ".js")) } : {}),
    files: [...o.files].sort(),
    ...(pkg.engines ? { engines: pkg.engines } : {}),
    ...(Object.keys(dependencies).length ? { dependencies } : {}),
    publishConfig: { access: "public" },
  };
}

function mapEntries(
  o: Record<string, string>,
  f: (k: string, v: string) => [string, string],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(o)
      .map(([k, v]) => f(k, v))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Built code as npm resolves it: relative `.ts` specifiers end in `.js` (tsc rewrites them in
 * JavaScript but not in declarations), and imports of publishable workspace packages use npm names.
 */
export function rewriteSpecifiers(code: string, publishable: string[]): string {
  return code.replace(
    /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"'\n]+)\2/g,
    (_m, lead: string, q: string, specifier: string) => {
      const relativeTs = /^\.{1,2}\/.+\.ts$/.test(specifier);
      const renamed = relativeTs
        ? `${specifier.slice(0, -3)}.js`
        : publishable.includes(specifier)
          ? npmName(specifier)
          : specifier;
      return `${lead}${q}${renamed}${q}`;
    },
  );
}
