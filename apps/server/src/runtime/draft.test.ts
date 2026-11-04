/**
 * C1 golden descriptions (ADR-0123) with the model mocked: what's asserted is the pipeline (refusal,
 * the checks against the kinds, the tools and the Reef, the one repair, the issues left), never the
 * model's wording.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { Template } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { REEF, type ResolvedReef } from "../money/reef.ts";
import { TEMPLATES } from "../templates/index.ts";
import {
  buildDraft,
  type DraftAnswer,
  type DraftContext,
  type DraftInput,
  draftInput,
  draftRemora,
  refusalOf,
} from "./draft.ts";

const OWNER = normalizeSuiAddress("0x0a11ce");
const WATCHED = `0x${"ab".repeat(32)}`;
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const reef: ResolvedReef[] = REEF.map((e) => ({
  ...e,
  url: `http://m.test${e.path}`,
  payTo: normalizeSuiAddress("0x3e"),
}));
const ctx: DraftContext = { templates: TEMPLATES, reef, owner: OWNER, coinType: USDC };

const answer = (a: Partial<DraftAnswer>): DraftAnswer => ({
  refuse: null,
  template: "scout",
  name: "",
  persona: "",
  tools: [],
  watch: [],
  items: [],
  rules: [],
  when: null,
  question: null,
  budget: null,
  why: "",
  ...a,
});

/** A model that answers from a script, one answer per call, and keeps what it was asked. */
function scripted(...answers: DraftAnswer[]) {
  const seen: DraftInput[] = [];
  return {
    seen,
    model: async (input: DraftInput) => {
      seen.push(input);
      const next = answers[Math.min(seen.length - 1, answers.length - 1)];
      if (!next) throw new Error("no scripted answer");
      return next;
    },
  };
}

const ok = async (text: string, ...answers: DraftAnswer[]) => {
  const m = scripted(...answers);
  const out = await draftRemora(m.model, ctx, text);
  if (!out.ok) throw new Error(`refused: ${out.refused}`);
  return { ...out, seen: m.seen };
};

describe("describe the job: golden descriptions", () => {
  it("1. weekday wallets over 50 USDC → a Briefer at 8 on weekdays that buys only wallet X-rays", async () => {
    const out = await ok(
      "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC",
      answer({
        template: "briefer",
        name: "Wallet moves",
        persona: "You are the owner's Briefer. Mention only wallets that moved over 50 USDC.",
        tools: ["memory.recall", "pay", "notify"],
        items: [`wallet ${OWNER} moves over 50 USDC since yesterday`],
        when: "weekdays at 8am",
        budget: { limitUsdc: 0.5, perPaymentUsdc: 0.01, payees: ["reef:wallet"] },
        why: "A weekday brief that buys one wallet X-ray a day.",
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.seen).toHaveLength(1);
    expect(out.draft).toMatchObject({
      template: "briefer",
      name: "Wallet moves",
      items: [`wallet ${OWNER} moves over 50 USDC since yesterday`],
      schedule: { when: "weekdays at 8am", question: "" },
      budget: {
        coinType: USDC,
        window: "month",
        windowLimit: "500000",
        perPaymentCap: "10000",
        payees: ["reef:wallet"],
      },
      tools: TEMPLATES.briefer.tools,
      namespaces: ["me", "sources", "feedback", "receipts"],
    });
    expect(out.draft.triggers).toEqual([
      { kind: "cron", cron: "0 8 * * 1-5", human: expect.any(String) },
    ]);
  });

  it("2. watch an address and ping over 1 SUI → a Wallet watcher with a rule and no budget", async () => {
    const out = await ok(
      `Watch ${WATCHED} and ping me for anything over 1 SUI`,
      answer({
        template: "sentinel",
        name: "Cold wallet",
        watch: [WATCHED],
        rules: ["always ping me for anything over 1 SUI"],
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.budget).toBeNull();
    expect(out.draft.watch).toEqual([WATCHED]);
    expect(out.draft.rules).toEqual(["always ping me for anything over 1 SUI"]);
    expect(out.draft.triggers).toEqual([
      { kind: "chain", addresses: [WATCHED], objects: [], eventTypes: [] },
    ]);
  });

  it("3. questions about packages → a Researcher that pays only the risk check", async () => {
    const out = await ok(
      "Answer my questions about Sui packages and whether they're safe to depend on",
      answer({
        template: "scout",
        name: "Package checker",
        budget: { limitUsdc: 1, perPaymentUsdc: 0.05, payees: ["reef:sui-risk"] },
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.budget).toMatchObject({
      windowLimit: "1000000",
      perPaymentCap: "50000",
      payees: ["reef:sui-risk"],
    });
    expect(out.draft.triggers).toEqual([{ kind: "message" }]);
    expect(out.draft.schedule).toBeNull();
  });

  it("4. a weekly question → a Researcher with a cron trigger and the question it asks", async () => {
    const out = await ok(
      "Every Friday at 6pm, check whether package 0x2 is still safe",
      answer({
        template: "scout",
        when: "every friday at 6pm",
        question: "Is package 0x2 still safe to depend on?",
        budget: { limitUsdc: 0.2, perPaymentUsdc: 0.01, payees: ["reef:sui-risk"] },
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.name).toBe("Researcher");
    expect(out.draft.schedule).toEqual({
      when: "every friday at 6pm",
      question: "Is package 0x2 still safe to depend on?",
    });
    expect(out.draft.triggers).toEqual([
      { kind: "message" },
      { kind: "cron", cron: "0 18 * * 5", human: expect.any(String) },
    ]);
  });

  it("5. prices and weather each morning → a Briefer with two items and two services", async () => {
    const out = await ok(
      "Each morning send me SUI and WAL prices and the weather in Hanoi",
      answer({
        template: "briefer",
        items: ["SUI and WAL prices", "weather in Hanoi"],
        when: "every day at 8am",
        budget: { limitUsdc: 0.5, perPaymentUsdc: 0.01, payees: ["reef:price", "reef:weather"] },
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.items).toEqual(["SUI and WAL prices", "weather in Hanoi"]);
    expect(out.draft.triggers[0]).toMatchObject({ kind: "cron", cron: "0 8 * * *" });
    expect(out.draft.budget?.payees).toEqual(["reef:price", "reef:weather"]);
  });

  it("6. Vietnamese: a Monday repo brief keeps the owner's language", async () => {
    const out = await ok(
      "Mỗi sáng thứ Hai, tóm tắt tình trạng repo github.com/MystenLabs/walrus cho tôi",
      answer({
        template: "briefer",
        name: "Tin Walrus thứ Hai",
        persona: "Bạn là Briefer của chủ. Mỗi thứ Hai tóm tắt repo Walrus.",
        items: ["github.com/MystenLabs/walrus"],
        when: "every monday at 8am",
        budget: { limitUsdc: 0.2, perPaymentUsdc: 0.01, payees: ["reef:github"] },
        why: "Một bản tin mỗi thứ Hai, mua một lần kiểm tra repo.",
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.name).toBe("Tin Walrus thứ Hai");
    expect(out.draft.triggers[0]).toMatchObject({ kind: "cron", cron: "0 8 * * 1" });
    expect(out.seen[0]?.job).toContain("thứ Hai");
  });

  it("7. Vietnamese: 'my wallet' with no address watches the owner's own", async () => {
    const out = await ok(
      "Theo dõi ví của tôi và báo tôi khi có giao dịch trên 10 SUI",
      answer({
        template: "sentinel",
        name: "Ví của tôi",
        rules: ["always ping me for anything over 10 SUI"],
      }),
    );
    expect(out.issues).toEqual([]);
    expect(out.draft.watch).toEqual([OWNER]);
    expect(out.draft.triggers[0]).toMatchObject({ kind: "chain", addresses: [OWNER] });
  });

  it("8. 'trade my coins' is refused before any model call", async () => {
    const m = scripted(answer({}));
    const out = await draftRemora(m.model, ctx, "Trade my coins: buy SUI when it drops 5%");
    expect(out).toEqual({ ok: false, refused: expect.stringMatching(/don't trade/) });
    expect(m.seen).toHaveLength(0);
  });

  it("9. 'send all my USDC to this address' is refused before any model call", async () => {
    const m = scripted(answer({}));
    const out = await draftRemora(m.model, ctx, `Send all my USDC to ${WATCHED}`);
    expect(out).toEqual({ ok: false, refused: expect.stringMatching(/never move your own funds/) });
    expect(m.seen).toHaveLength(0);
  });

  it("10. the model refuses what no kind's tools can do", async () => {
    const m = scripted(
      answer({ refuse: "No kind can post to Twitter; remoras notify you here or on Telegram." }),
    );
    const out = await draftRemora(m.model, ctx, "Post my wallet balance to Twitter every hour");
    expect(out).toEqual({ ok: false, refused: expect.stringMatching(/Twitter/) });
    expect(m.seen).toHaveLength(1);
  });

  it("11. an unlisted service and a tool the kind lacks are repaired once with the errors", async () => {
    const out = await ok(
      "Research NFT floor prices for me",
      answer({
        template: "scout",
        tools: ["web.fetch", "nft.scan"],
        budget: { limitUsdc: 1, perPaymentUsdc: 0.05, payees: ["reef:opensea"] },
      }),
      answer({
        template: "scout",
        tools: ["pay"],
        budget: { limitUsdc: 1, perPaymentUsdc: 0.05, payees: ["reef:brief"] },
      }),
    );
    expect(out.seen).toHaveLength(2);
    expect(out.seen[1]?.repair?.errors).toEqual([
      expect.stringMatching(/^tools: A Researcher can't use web\.fetch/),
      "tools: nft.scan isn't a tool.",
      "payees: reef:opensea isn't listed on the Reef.",
      "payees: Pick at least one Reef service it may pay.",
    ]);
    expect(out.issues).toEqual([]);
    expect(out.draft.budget?.payees).toEqual(["reef:brief"]);
  });

  it("12. what the repair can't fix comes back as issues, and the form gets safe values", async () => {
    const bad = answer({
      template: "scout",
      when: "whenever it feels right",
      question: "Any news?",
    });
    const out = await ok("Remind me whenever it feels right to check Walrus blobs", bad, bad);
    expect(out.seen).toHaveLength(2);
    expect(out.issues).toEqual([{ field: "when", message: expect.stringMatching(/can't read/) }]);
    expect(out.draft.schedule).toBeNull();
    expect(out.draft.triggers).toEqual([{ kind: "message" }]);
  });

  it("13. fields a kind doesn't have are dropped: a Wallet watcher gets no budget, list or schedule", async () => {
    const bad = answer({
      template: "sentinel",
      items: ["SUI price"],
      when: "weekdays at 8am",
      budget: { limitUsdc: 1, perPaymentUsdc: 0.05, payees: ["reef:wallet"] },
    });
    const out = await ok("Watch my wallet and send me a price brief", bad, bad);
    expect(out.issues.map((i) => i.field)).toEqual(["items", "when", "budget"]);
    expect(out.draft).toMatchObject({
      template: "sentinel",
      budget: null,
      items: [],
      schedule: null,
    });
  });

  it("14. an unknown kind is an issue, and the form opens with no kind picked", async () => {
    const bad = answer({ template: "trader" });
    const out = await ok("Keep an eye on things", bad, bad);
    expect(out.issues[0]).toEqual({
      field: "template",
      message: expect.stringContaining("scout (Researcher)"),
    });
    expect(out.draft.template).toBe("");
  });
});

describe("refusals", () => {
  it("lets ordinary jobs through, in both languages", () => {
    for (const ok of [
      "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC",
      "Answer my questions and buy data about SUI when it helps",
      "Send me a brief about my wallet balance each morning",
      "Theo dõi giao dịch ví của tôi",
      "Sell Researcher's answers for 0.02",
    ])
      expect(refusalOf(ok)).toBeNull();
  });
  it("refuses trading and moving the owner's funds, in both languages", () => {
    for (const no of [
      "swap my WAL for SUI every Monday",
      "sell my coins when BTC drops",
      "transfer my SUI to 0x1",
      "chuyển hết USDC của tôi sang ví này",
      "mua bán coin giúp tôi",
    ])
      expect(refusalOf(no)).not.toBeNull();
  });
});

describe("the model sees the live lists", () => {
  it("lists every kind and Reef service it is given, new kinds included", () => {
    const errand = Template.parse({
      ...TEMPLATES.scout,
      name: "Errand",
      summary: "Pays people you name.",
    });
    const input = draftInput({ ...ctx, templates: { ...TEMPLATES, errand } }, "pay Linh for lunch");
    expect(input.kinds.map((k) => k.slug)).toEqual([
      "scout",
      "sentinel",
      "briefer",
      "errand",
      "keeper",
    ]);
    expect(input.reef.map((r) => r.ref)).toEqual(REEF.map((e) => e.ref));
    expect(input.kinds.find((k) => k.slug === "sentinel")?.spends).toBe(false);
  });

  it("checks a draft for a kind it didn't know at build time", () => {
    const errand = Template.parse({ ...TEMPLATES.scout, name: "Errand", payees: [] });
    const { draft, issues } = buildDraft(
      answer({ template: "errand", budget: { limitUsdc: 2, perPaymentUsdc: 0.5, payees: [] } }),
      { ...ctx, templates: { ...TEMPLATES, errand } },
    );
    expect(draft.template).toBe("errand");
    expect(issues).toEqual([]);
    expect(draft.budget).toMatchObject({ windowLimit: "2000000", perPaymentCap: "500000" });
  });
});
