import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ApprovalRequest,
  BudgetMeter,
  COPY_KEYS,
  DEPLOYMENTS,
  Deployment,
  DetectFundsResponse,
  DetectFundsResult,
  DiagnoseReport,
  ERROR_CODES,
  errorCopyKey,
  FeedItem,
  FundsTxResponse,
  HatchConsent,
  HatcheryListing,
  HealthReport,
  InboundMessage,
  InspectorResponse,
  intentHash,
  isCatalogModel,
  LearningSeries,
  McpCall,
  McpToken,
  McpTokenCreated,
  MemoryRow,
  MODEL_CATALOG,
  ModelInfo,
  NetworksResponse,
  OutboundMessage,
  OwnerSettings,
  PlaygroundSession,
  ProofOfLearning,
  RemoraConfig,
  RemoraEvent,
  RemoraMemoryExport,
  RemoraView,
  Room,
  RoomMessage,
  SafetyReport,
  Schedule,
  SchedulePreview,
  ShareReview,
  TeamFile,
  TeamPreview,
  Template,
  VerifyResult,
  Wake,
  WakeView,
} from "./index.ts";

const dir = new URL("../fixtures/", import.meta.url);
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), "utf8"));

/** Every fixture file must be listed here, so the consumer side can trust all of them. */
const FIXTURES: Record<string, z.ZodType> = {
  "approval.over-limit.json": ApprovalRequest,
  "budget-meter.json": BudgetMeter,
  "feed.items.json": z.array(FeedItem),
  "inspector.json": InspectorResponse,
  "owner-settings.json": OwnerSettings,
  "remora-view.scout.json": RemoraView,
  "room.team.json": Room,
  "room-messages.json": z.array(RoomMessage),
  "schedule.json": Schedule,
  "team.json": TeamFile,
  "team-preview.json": TeamPreview,
  "schedule-preview.json": SchedulePreview,
  "verify-result.payment.json": VerifyResult,
  "channel.inbound.json": InboundMessage,
  "channel.outbound.json": OutboundMessage,
  "events.feed.json": z.array(RemoraEvent),
  "funds.detect.json": DetectFundsResult,
  "funds.detect-response.json": DetectFundsResponse,
  "diagnose.report.json": DiagnoseReport,
  "funds.move-tx.json": FundsTxResponse,
  "health.report.json": HealthReport,
  "playground.session.json": PlaygroundSession,
  "hatchery.consent.json": HatchConsent,
  "hatchery.listings.json": z.array(HatcheryListing),
  "hatchery.safety-block.json": SafetyReport,
  "hatchery.share-review.json": ShareReview,
  "learning-series.json": z.array(LearningSeries),
  "memory-export.remora.json": RemoraMemoryExport,
  "proof-of-learning.json": ProofOfLearning,
  "memory.rows.json": z.array(MemoryRow),
  "networks.json": NetworksResponse,
  "remora-config.scout.json": RemoraConfig,
  "remora-config.sentinel.json": RemoraConfig,
  "template.scout.json": Template,
  "wake-view.payment.json": WakeView,
  "wake.payment.json": Wake,
  "wake.mcp-payment.json": Wake,
  "mcp.token.json": McpToken,
  "mcp.token-created.json": McpTokenCreated,
  "mcp.calls.json": z.array(McpCall),
};

describe("contract fixtures", () => {
  it("lists every fixture file", () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
    expect(files).toEqual(Object.keys(FIXTURES).sort());
  });

  it.each(Object.entries(FIXTURES))("%s parses with its schema", (name, schema) => {
    const parsed = schema.safeParse(read(name));
    expect(parsed.error?.issues ?? []).toEqual([]);
  });

  it("anchors the wake view's intent hash to the wake's intent", () => {
    const view = WakeView.parse(read("wake-view.payment.json"));
    expect(view.intentHash).toBe(intentHash(view.wake.intent));
  });
});

describe("contract helpers", () => {
  it("hashes an intent the same whatever the key order", () => {
    const wake = Wake.parse(read("wake.payment.json"));
    const reordered = Object.fromEntries(Object.entries(wake.intent).reverse());
    expect(intentHash(reordered as typeof wake.intent)).toBe(intentHash(wake.intent));
  });

  it("has a copy key for every error code", () => {
    for (const code of ERROR_CODES) expect(COPY_KEYS).toContain(errorCopyKey(code));
  });

  it("keeps the deployment table valid", () => {
    for (const d of Object.values(DEPLOYMENTS)) expect(Deployment.safeParse(d).success).toBe(true);
  });

  it("puts an MCP Wake's client in the hashed trigger as well as in via", () => {
    const wake = Wake.parse(read("wake.mcp-payment.json"));
    expect(wake.via).toBe("mcp:claude-code");
    expect(wake.intent.trigger.ref).toBe(wake.via);
    expect(Wake.safeParse({ ...wake, via: "claude-code" }).success).toBe(false);
  });

  it("never lets a token view carry its secret", () => {
    const parsed = McpToken.parse({ ...(read("mcp.token.json") as object), secret: "x" });
    expect("secret" in parsed).toBe(false);
  });

  it("rejects a raw payee address in a template", () => {
    const template = read("template.scout.json") as Record<string, unknown>;
    const bad = { ...template, payees: [`0x${"6d".repeat(32)}`] };
    expect(Template.safeParse(bad).success).toBe(false);
  });
});

describe("model catalog (D9, ADR-0042)", () => {
  it("lists unique tool-calling models at most $1 per 1M tokens", () => {
    for (const m of MODEL_CATALOG) ModelInfo.parse(m);
    expect(new Set(MODEL_CATALOG.map((m) => m.id)).size).toBe(MODEL_CATALOG.length);
    expect(isCatalogModel("anthropic/claude-haiku-5.5")).toBe(true);
    expect(isCatalogModel("x/unknown")).toBe(false);
    expect(isCatalogModel(undefined)).toBe(false);
  });
});

describe("team files (ADR-0042)", () => {
  it("reject a per-payment cap above the monthly limit and more than ten remoras", () => {
    const team = TeamFile.parse(read("team.json"));
    const scout = team.remoras[0];
    if (!scout) throw new Error("no scout");
    expect(
      TeamFile.safeParse({
        ...team,
        remoras: [{ ...scout, budget: { monthlyUsd: 1, perPaymentUsd: 2 } }],
      }).success,
    ).toBe(false);
    expect(TeamFile.safeParse({ ...team, remoras: Array(11).fill(scout) }).success).toBe(false);
  });
});

describe("hatchery (ADR-0046)", () => {
  it("shares a team file, and a hatch always starts in shadow mode with one signature at most", () => {
    const review = ShareReview.parse(read("hatchery.share-review.json"));
    expect(review.team.schema).toBe("remora.team/v1");
    const consent = HatchConsent.parse(read("hatchery.consent.json"));
    expect(HatchConsent.safeParse({ ...consent, startsInShadow: false }).success).toBe(false);
    expect(HatchConsent.safeParse({ ...consent, signatures: 2 }).success).toBe(false);
  });

  it("keeps payees to Reef references", () => {
    const consent = HatchConsent.parse(read("hatchery.consent.json"));
    const raw = { ...consent.payees[0], ref: `0x${"6d".repeat(32)}` };
    expect(HatchConsent.safeParse({ ...consent, payees: [raw] }).success).toBe(false);
  });

  it("names the memory delta in a proof", () => {
    const proof = ProofOfLearning.parse(read("proof-of-learning.json"));
    const used = new Set(proof.after.memories.map((m) => m.blobId));
    for (const d of proof.delta) expect(used.has(d.blobId)).toBe(true);
  });

  it("defaults the new memory-control fields for older inspector payloads", () => {
    const row = InspectorResponse.parse({
      ...(read("inspector.json") as object),
      rows: [
        {
          namespace: "rules",
          blobId: "Zr8_x2LmQe4TtY1",
          createdAt: "2026-10-22T03:12:00Z",
          expiresAt: null,
          status: "active",
          size: 10,
        },
      ],
    }).rows[0];
    expect(row).toMatchObject({
      hiddenAt: null,
      supersededBy: null,
      expiresSoon: false,
      type: null,
    });
  });
});

describe("launch shapes (ADR-0051, ADR-0052)", () => {
  it("a playground session spends inside its Disc and counts questions down", () => {
    const s = PlaygroundSession.parse(read("playground.session.json"));
    expect(Number(s.spentUsdc)).toBeLessThanOrEqual(Number(s.budgetUsdc));
    expect(s.questionsLeft + s.answers.length).toBe(s.limits.questionsPerSession);
    expect(PlaygroundSession.safeParse({ ...s, questionsLeft: -1 }).success).toBe(false);
  });

  it("a diagnose report with a down item doesn't let a deploy through", () => {
    const d = DiagnoseReport.parse(read("diagnose.report.json"));
    expect(d.ok).toBe(d.items.every((i) => i.status !== "down"));
    expect(d.items.find((i) => i.status === "down")?.fix).toBeTruthy();
    expect(HealthReport.parse(read("health.report.json")).errors[0]?.code).toBe("relayer.slow");
  });
});
