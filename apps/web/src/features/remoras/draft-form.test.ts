import { RemoraDraft } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { formFromDraft, setupFromForm } from "./draft-form";

const OWNER = `0x${"3d".repeat(32)}`;
const briefer = RemoraDraft.parse({
  template: "briefer",
  name: "Wallet moves",
  persona: "You are the owner's Briefer. Mention only moves over 50 USDC.",
  tools: ["memory.recall", "pay", "notify"],
  triggers: [{ kind: "cron", cron: "0 8 * * 1-5", human: "weekdays at 08:00" }],
  namespaces: ["me", "sources", "feedback", "receipts"],
  budget: {
    coinType: "0xa1ec::usdc::USDC",
    windowLimit: "500000",
    window: "month",
    perPaymentCap: "10000",
    payees: ["reef:wallet"],
  },
  items: [`wallet ${OWNER} moves over 50 USDC since yesterday`],
  schedule: { when: "weekdays at 8am", question: "" },
  why: "One wallet X-ray a weekday.",
});

describe("a draft in the create form", () => {
  it("fills the picker's fields and the draft's own", () => {
    expect(formFromDraft(briefer)).toEqual({
      slug: "briefer",
      name: "Wallet moves",
      persona: briefer.persona,
      monthly: "0.50",
      perPayment: "0.01",
      payees: ["reef:wallet"],
      follow: `wallet ${OWNER} moves over 50 USDC since yesterday`,
      when: "weekdays at 8am",
      question: "",
      rules: "",
    });
  });

  it("sends setup only what the kind doesn't already have", () => {
    const f = {
      slug: "briefer",
      persona: briefer.persona,
      when: "weekdays at 8am",
      question: "",
      rules: "",
    };
    expect(setupFromForm(f, "You are the owner's Briefer.")).toEqual({
      persona: briefer.persona,
      schedule: { when: "weekdays at 8am", question: "" },
    });
    expect(
      setupFromForm(
        { ...f, persona: "You are the owner's Briefer.", when: "" },
        "You are the owner's Briefer.",
      ),
    ).toBeNull();
    expect(
      setupFromForm(
        { slug: "sentinel", persona: "", when: "daily", question: "", rules: "a\n\n b " },
        undefined,
      ),
    ).toEqual({ rules: ["a", "b"] });
  });
});
