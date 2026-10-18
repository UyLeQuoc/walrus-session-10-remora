import { describe, expect, it } from "vitest";
import {
  classify,
  deploymentsCovering,
  errorKind,
  formatOps,
  type OpsInput,
  summarizeLogs,
} from "./report.ts";

const at = "2026-09-25T00:00:00Z";
const line = (message: string, level = "info") => ({ message, timestamp: at, level });

// Each of these is a line the server really writes; see the console calls they
// were copied from. If a prefix changes there, this is where it shows.
const REAL = [
  ["[memory] recall in hippo-guest:4f1c dropped all 5 candidates (attempt 1/4)", "recall-dropped"],
  ["[memory] recall in hippo gave up after 4 dropped attempts", "recall-gave-up"],
  ["[memory] recall failed Error: relayer said no", "recall-failed"],
  ["[memory] corrections recall failed Error: x", "recall-failed"],
  ["[memory] secondary recall failed Error: x", "recall-failed"],
  ["[memory] write failed in hippo: seal encrypt failed", "write-failed"],
  ["[memory] dedupe check failed in hippo, writing anyway: 429", "dedupe-failed"],
  ["[model] primary failed, trying the fallback Error: 503", "model-fallback"],
  ["[web] stream failed Error: aborted", "stream-failed"],
  ["[discord] failed to start Error: bad token", "adapter-failed"],
  ["[ratelimit] noteCommand Error: db", "bookkeeping-failed"],
  ["[export] recovery recall failed relayer said no", "export-degraded"],
  ["Invalid environment:", "startup-failed"],
  ["Node.js v20.20.2", "process-crashed"],
  ["[process] unhandled rejection Error: x", "unhandled"],
  [
    "[telegram] polling stopped: another process is polling this bot (409); retrying in 5s",
    "adapter-failed",
  ],
] as const;

describe("classify", () => {
  it.each(REAL)("%s", (message, kind) => {
    expect(classify(line(message, "error"))?.kind).toBe(kind);
  });

  it("splits turn and command failures by channel", () => {
    expect(classify(line("[telegram] turn failed Error: Too Many Requests"))).toEqual({
      kind: "turn-failed",
      channel: "telegram",
    });
    expect(classify(line("[web] command failed Error: boom"))).toEqual({
      kind: "command-failed",
      channel: "web",
    });
    expect(classify(line("[cli] logTurn Error: db"))).toEqual({
      kind: "bookkeeping-failed",
      channel: "cli",
    });
  });

  it("treats a bare telegram error as the adapter failing, but not its startup line", () => {
    expect(classify(line("[telegram] GrammyError: Call to getUpdates failed", "error"))?.kind).toBe(
      "adapter-failed",
    );
    expect(classify(line("[telegram] @walrussession8_bot polling", "info"))).toBeNull();
  });

  it("ignores ordinary lines", () => {
    expect(classify(line("hippo server on http://localhost:8787"))).toBeNull();
    expect(classify(line("    at gatherContext (agent.ts:89:7)", "error"))).toBeNull();
  });
});

describe("summarizeLogs", () => {
  it("counts kinds and channels and leaves stack frames as unclassified", () => {
    const s = summarizeLogs([
      line("[memory] recall in hippo dropped all 3 candidates (attempt 1/4)", "warn"),
      line("[memory] recall in hippo dropped all 3 candidates (attempt 2/4)", "warn"),
      line("[telegram] turn failed Error: x", "error"),
      line("    at x (y.ts:1:1)", "error"),
      line("[web] turn failed Error: y", "error"),
      line("started", "info"),
    ]);
    expect(s.lines).toBe(6);
    expect(s.counts["recall-dropped"]).toBe(2);
    expect(s.counts["turn-failed"]).toBe(2);
    expect(s.byChannel["turn-failed"]).toEqual({ telegram: 1, web: 1 });
    expect(s.unclassifiedErrors).toBe(1);
  });
});

describe("errorKind", () => {
  it("masks ids, hashes and numbers so the same failure groups together", () => {
    const a = errorKind(
      "Remember job 3f2b1c4d-1111-2222-3333-444455556666 failed: seal encrypt failed after 3 tries at 0xabc123",
    );
    const b = errorKind(
      "Remember job 9a8b7c6d-aaaa-bbbb-cccc-ddddeeeeffff failed: seal encrypt failed after 4 tries at 0xdef456",
    );
    expect(a).toBe(b);
    expect(a).toContain("seal encrypt failed");
    expect(errorKind(null)).toBe("(no error recorded)");
  });

  it("keeps only the first line, capped", () => {
    expect(errorKind(`boom\n${"x".repeat(500)}`)).toBe("boom");
    expect(errorKind("y ".repeat(200)).length).toBeLessThanOrEqual(100);
  });
});

describe("deploymentsCovering", () => {
  const d = (id: string, status: string, createdAt: string) => ({ id, status, createdAt });
  const all = [
    d("a", "REMOVED", "2026-09-23T10:00:00Z"),
    d("b", "REMOVED", "2026-09-23T20:00:00Z"),
    d("c", "FAILED", "2026-09-24T01:00:00Z"),
    d("x", "REMOVED", "2026-09-24T02:00:00Z"),
    d("e", "SUCCESS", "2026-09-24T12:00:00Z"),
  ];

  it("reads every deployment in the window and the ones that could have been running at its start", () => {
    const got = deploymentsCovering(all, new Date("2026-09-24T00:00:00Z"), 2).map((x) => x.id);
    expect(got).toEqual(["a", "b", "x", "e"]);
  });

  it("never reads a deployment that failed to build", () => {
    const got = deploymentsCovering(all, new Date("2026-09-20T00:00:00Z")).map((x) => x.id);
    expect(got).not.toContain("c");
  });
});

describe("formatOps", () => {
  const base: OpsInput = {
    since: new Date("2026-09-24T00:00:00Z"),
    until: new Date("2026-09-25T00:00:00Z"),
    turns: 12,
    commands: 3,
    writes: { failed: [], stuck: 0, inFlight: 0, stored: 9 },
    logs: summarizeLogs([]),
    deployments: 1,
  };

  it("says a clean day is clean", () => {
    expect(formatOps(base).at(-1)).toBe("Verdict: nobody hit a failure they could feel.");
  });

  it("counts what a person felt, and not what they did not", () => {
    const out = formatOps({
      ...base,
      writes: { ...base.writes, failed: [{ error: "seal encrypt failed", channel: "telegram" }] },
      logs: summarizeLogs([
        line("[memory] recall in hippo gave up after 4 dropped attempts", "warn"),
        // A retried drop and a fallback answer are invisible to the person.
        line("[memory] recall in hippo dropped all 2 candidates (attempt 1/4)", "warn"),
        line("[model] primary failed, trying the fallback", "warn"),
      ]),
    });
    expect(out.at(-1)).toMatch(/^Verdict: 2 failure\(s\) a person could feel/);
    expect(out).toContain("    1 × telegram: seal encrypt failed");
  });

  it("counts a crash as felt: every channel was down", () => {
    const out = formatOps({ ...base, logs: summarizeLogs([line("Node.js v20.20.2", "error")]) });
    expect(out.at(-1)).toMatch(/^Verdict: 1 failure\(s\)/);
  });

  it("never passes an unread log off as a clean day", () => {
    const out = formatOps({ ...base, logs: null, logsError: "railway: command not found" });
    expect(out.join("\n")).toContain("LOGS NOT READ: railway: command not found");
    expect(out.at(-1)).toMatch(/^Verdict: logs unread/);
  });

  it("prints no log message bodies", () => {
    const secret = "[telegram] turn failed Error: my card number is 4111";
    const out = formatOps({ ...base, logs: summarizeLogs([line(secret, "error")]) }).join("\n");
    expect(out).not.toContain("card number");
    expect(out).toMatch(/ {3}1 {2}turns that failed.*\(telegram 1\)/);
  });
});
