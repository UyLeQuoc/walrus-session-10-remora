import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ApprovalRequest,
  COPY_KEYS,
  DEPLOYMENTS,
  Deployment,
  DetectFundsResult,
  ERROR_CODES,
  errorCopyKey,
  InboundMessage,
  intentHash,
  MemoryRow,
  OutboundMessage,
  RemoraConfig,
  RemoraEvent,
  Template,
  Wake,
  WakeView,
} from "./index.ts";

const dir = new URL("../fixtures/", import.meta.url);
const read = (name: string): unknown => JSON.parse(readFileSync(new URL(name, dir), "utf8"));

/** Every fixture file must be listed here, so the consumer side can trust all of them. */
const FIXTURES: Record<string, z.ZodType> = {
  "approval.over-limit.json": ApprovalRequest,
  "channel.inbound.json": InboundMessage,
  "channel.outbound.json": OutboundMessage,
  "events.feed.json": z.array(RemoraEvent),
  "funds.detect.json": DetectFundsResult,
  "memory.rows.json": z.array(MemoryRow),
  "remora-config.scout.json": RemoraConfig,
  "remora-config.sentinel.json": RemoraConfig,
  "template.scout.json": Template,
  "wake-view.payment.json": WakeView,
  "wake.payment.json": Wake,
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

  it("rejects a raw payee address in a template", () => {
    const template = read("template.scout.json") as Record<string, unknown>;
    const bad = { ...template, payees: [`0x${"6d".repeat(32)}`] };
    expect(Template.safeParse(bad).success).toBe(false);
  });
});
