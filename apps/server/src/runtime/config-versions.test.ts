import { describe, expect, it } from "vitest";
import { changedFields, configDiff, sameValue, settingsOf } from "./config-versions.ts";

const budget = {
  coinType: "0x2::usdc::USDC",
  windowLimit: "1000000",
  window: "month",
  perPaymentCap: "50000",
  payees: ["reef:weather", "reef:brief"],
};
const base = {
  version: 1,
  id: "r1",
  name: "Researcher",
  persona: "Answers.",
  template: "scout",
  identity: { address: "0x1" },
  triggers: [{ kind: "message" }],
  budget,
  revision: 2,
  keyId: "r1:2",
};

describe("config versions (N11)", () => {
  it("shows settings, not bookkeeping, and splits the limits from the payees", () => {
    const s = settingsOf({ ...base, tgWas: "active", crewWas: "shadow", keyGeneration: 2 });
    expect(Object.keys(s).sort()).toEqual(["budget", "name", "payees", "persona", "triggers"]);
    expect(s.budget).not.toHaveProperty("payees");
    expect(s.payees).toEqual(budget.payees);
  });

  it("compares by value, whatever the key order", () => {
    expect(sameValue({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 })).toBe(
      true,
    );
    expect(sameValue({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(sameValue([1, 2], [2, 1])).toBe(false);
  });

  it("lists what changed, in the Settings order, ignoring the revision and the key", () => {
    const next = {
      ...base,
      revision: 3,
      keyId: "r1:3",
      persona: "Answers briefly.",
      name: "Scout",
      budget: { ...budget, perPaymentCap: "20000", payees: ["reef:weather"] },
      schedules: [{ id: "s1" }],
    };
    expect(changedFields(base, next)).toEqual(["name", "persona", "budget", "payees", "schedules"]);
    expect(changedFields(base, { ...base, revision: 9 })).toEqual([]);
  });

  it("says how each field comes back: at once, with a signature, or not here", () => {
    const diff = configDiff(
      { ...base, model: "x/a", sell: { on: true, slug: "uy", price: "20000", blurb: "" } },
      { ...base, persona: "Old.", budget: { ...budget, windowLimit: "2000000" }, contacts: [] },
    );
    expect(diff.map((d) => [d.field, d.restore])).toEqual([
      ["persona", "direct"],
      ["model", "direct"],
      ["sell", "direct"],
      ["budget", "signature"],
      ["contacts", "none"],
    ]);
    expect(diff[1]).toMatchObject({ label: "Brain", current: "x/a", version: undefined });
    expect(diff[3]?.version).toMatchObject({ windowLimit: "2000000" });
  });
});
