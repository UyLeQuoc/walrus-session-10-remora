import { describe, expect, it } from "vitest";
import { REEF } from "../money/reef.ts";
import { TEMPLATES } from "../templates/index.ts";
import { briefItem, briefQuestion } from "./brief-question.ts";
import { planBuys } from "./scout.ts";

const MERCHANT = "http://m.test";
const reef = REEF.map((e) => ({ ...e, url: `${MERCHANT}${e.path}`, payTo: "0x3e" }));
const addr = `0x${"ab".repeat(32)}`;

describe("the Briefer's question (ADR-0106)", () => {
  it("puts each kind of item in words the planner reads", () => {
    expect(briefItem(addr)).toBe(`what does wallet ${addr} hold`);
    expect(briefItem("github.com/MystenLabs/sui")).toBe(
      "how healthy is https://github.com/MystenLabs/sui",
    );
    expect(briefItem("SUI and WAL prices")).toBe("what are SUI and WAL worth");
    expect(briefItem("BTC, ETH")).toBe("what are BTC, ETH worth");
    expect(briefItem("weather in hanoi")).toBe("the weather in Hanoi");
    expect(briefItem("Da Nang weather")).toBe("the weather in Da Nang");
    expect(briefItem("odds for tonight's match")).toBe("odds for tonight's match");
  });

  it("buys one service per item in a single brief", () => {
    const q = briefQuestion([
      "SUI and WAL prices",
      addr,
      "github.com/MystenLabs/walrus",
      "weather in Hanoi",
    ]);
    expect(planBuys(q, reef).map((b) => b.entry.slug)).toEqual([
      "wallet",
      "github",
      "price",
      "weather",
    ]);
    // Never a Brief of its own question, and each purchase under a Briefer's per-payment cap.
    expect(planBuys(q, reef).some((b) => b.entry.slug === "brief")).toBe(false);
    const cap = Number(TEMPLATES.briefer.budgetSuggestion.perPaymentUsd) * 1e6;
    for (const b of planBuys(q, reef)) expect(Number(b.entry.price)).toBeLessThanOrEqual(cap);
  });

  it("pays only what the Researcher may pay", () => {
    expect([...TEMPLATES.briefer.payees].sort()).toEqual([...TEMPLATES.scout.payees].sort());
  });
});
