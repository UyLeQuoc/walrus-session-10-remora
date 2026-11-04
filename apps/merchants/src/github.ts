/**
 * ADR-0106 `github`: a repository's health from GitHub's public API (no key): stars, forks, open
 * issues, its license, whether it's archived, and how long since its last push. Read before the
 * payment (`sourceFirst`): a repo that doesn't exist answers 400, a GitHub that doesn't answer 502,
 * both free. Ten minutes' cache per repo keeps the public limit (60 an hour) away.
 */
import {
  type PaidContext,
  retryingFetch,
  SourceInputError,
  sourceFirst,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

export interface RepoHealth {
  source: "GitHub";
  repo: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  archived: boolean;
  lastPush: string;
  daysSincePush: number;
  flags: string[];
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const cache = new Map<string, { at: number; value: RepoHealth }>();

export async function healthOf(
  owner: string,
  repo: string,
  http: typeof fetch = fetch,
  now = Date.now(),
): Promise<RepoHealth> {
  const key = `${owner}/${repo}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && now - hit.at < 600_000) return hit.value;
  const res = await http(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: { accept: "application/vnd.github+json", "user-agent": "remora-merchant" },
  });
  if (res.status === 404)
    throw new SourceInputError("unknown_repo", `No public repo ${owner}/${repo}.`);
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const r = (await res.json()) as {
    full_name: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    license: { spdx_id?: string } | null;
    archived: boolean;
    pushed_at: string;
  };
  const daysSincePush = Math.floor((now - Date.parse(r.pushed_at)) / 86_400_000);
  const flags: string[] = [];
  if (r.archived) flags.push("archived: no longer maintained");
  if (!r.license?.spdx_id || r.license.spdx_id === "NOASSERTION") flags.push("no clear license");
  if (daysSincePush > 180) flags.push(`no push in ${daysSincePush} days`);
  const value: RepoHealth = {
    source: "GitHub",
    repo: r.full_name,
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count,
    openIssues: r.open_issues_count,
    license: r.license?.spdx_id ?? null,
    archived: r.archived,
    lastPush: r.pushed_at,
    daysSincePush,
    flags,
  };
  cache.set(key, { at: now, value });
  return value;
}

export function createGithubApp(o: { pay: X402Options; fetch?: typeof fetch }) {
  const app = new Hono<{ Variables: { x402: PaidContext; source: RepoHealth } }>();
  const http = retryingFetch(o.fetch);
  app.get(
    "/github/:owner/:repo",
    sourceFirst(
      async (c) => healthOf(c.req.param("owner") ?? "", c.req.param("repo") ?? "", http),
      (c) => {
        if (!NAME.test(c.req.param("owner") ?? "") || !NAME.test(c.req.param("repo") ?? ""))
          throw new SourceInputError("bad_repo", "Name a repo as owner/repo.");
      },
      { early: true },
    ),
    x402(o.pay),
    (c) => c.json({ ...c.get("source"), paid: c.get("x402") }),
  );
  return app;
}
