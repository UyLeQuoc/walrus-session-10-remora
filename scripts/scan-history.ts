/**
 * Before the repo goes public (ADR-0085): fails when any line ever added on any branch looks like a
 * secret, or when an `.env` file was ever committed. CI's secrets step checks only the current tree.
 * It prints the commit, the path and the pattern, never the value.
 *   bun scripts/scan-history.ts
 */
import { spawnSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;

const PATTERNS: Record<string, RegExp> = {
  "sui-privkey": /suiprivkey1[0-9a-z]{50,}/g,
  "pem-private": /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  "tatum-key": /\bt-[0-9a-f]{24}-[0-9a-f]{20,}\b/g,
  openrouter: /sk-or-v1-[0-9a-f]{40,}/g,
  anthropic: /sk-ant-[A-Za-z0-9_-]{20,}/g,
  openai: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/g,
  "telegram-bot": /\b\d{8,10}:AA[0-9A-Za-z_-]{30,}/g,
  slack: /\bxox[abprs]-[0-9A-Za-z-]{10,}/g,
  github: /\b(?:ghp_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{30,})/g,
  enoki: /enoki_(?:private|apikey)_[0-9a-f]{16,}/g,
  google: /AIza[0-9A-Za-z_-]{35}/g,
  aws: /\bAKIA[0-9A-Z]{16}\b/g,
  "pg-password": /postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@([^/\s:]+)/g,
  "hex64-assigned":
    /(?:PRIVATE_KEY|SECRET|KEY_ENCRYPTION_KEY|DELEGATE_KEY|PRIVKEY|API_KEY)[A-Z_]*\s*[=:]\s*["']?(?:0x)?[0-9a-fA-F]{64}\b/g,
};
// Local databases and placeholders are fine in history.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "postgres", "db", "host", "HOST"]);
const PLACEHOLDERS = new Set(["postgres", "password", "pass", "remora", "test", "secret"]);

const git = (...args: string[]) =>
  spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8", maxBuffer: 1 << 30 }).stdout;

const hits = new Map<string, string>();
let commit = "?";
let path = "?";
let lines = 0;
for (const line of git(
  "log",
  "--all",
  "-p",
  "--no-color",
  "--unified=0",
  "--format=@@@COMMIT %h",
).split("\n")) {
  if (line.startsWith("@@@COMMIT ")) commit = line.slice(10);
  else if (line.startsWith("+++ "))
    path = line.startsWith("+++ b/") ? line.slice(6) : line.slice(4);
  else if (line.startsWith("+")) {
    lines++;
    for (const [name, rx] of Object.entries(PATTERNS)) {
      for (const m of line.slice(1).matchAll(rx)) {
        if (name === "pg-password") {
          const [, pw = "", host = ""] = m;
          if (
            LOCAL_HOSTS.has(host) ||
            PLACEHOLDERS.has(pw) ||
            pw.startsWith("$") ||
            pw.includes("<")
          )
            continue;
        }
        const key = `${name}  ${path}  (length ${m[0].length})`;
        if (!hits.has(key)) hits.set(key, commit);
      }
    }
  }
}

const envFiles = [
  ...new Set(
    git("log", "--all", "--name-only", "--format=")
      .split("\n")
      .filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith(".env.example")),
  ),
];

const commits = git("rev-list", "--all", "--count").trim();
for (const [key, c] of hits) console.error(`secret-shaped  ${c}  ${key}`);
for (const f of envFiles) console.error(`.env committed  ${f}`);
if (hits.size || envFiles.length) {
  console.error(
    `\n${hits.size + envFiles.length} finding(s) in ${commits} commits. Rotate those keys first; a history rewrite is Uy's call.`,
  );
  process.exit(1);
}
console.log(
  `${commits} commits, ${lines} added lines: nothing secret-shaped, no .env file ever committed.`,
);
