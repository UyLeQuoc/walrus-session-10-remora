import { describe, expect, it } from "vitest";
import { calendarDay } from "@/components/app/budget-meter";
import { describeRemora } from "./describe";

const catalog = {
  scout: {
    persona: "You are Scout. You answer the owner's questions by buying data.",
    summary: "Answers questions by buying the best data.",
  },
};

describe("describeRemora (ADR-0088)", () => {
  it("shows the template's summary for an unchanged persona, never the system prompt", () => {
    const r = { template: "scout", config: { persona: catalog.scout.persona } };
    expect(describeRemora(r, catalog)).toBe("Answers questions by buying the best data.");
  });

  it("drops the opening 'You are …' from an edited or unknown persona", () => {
    expect(
      describeRemora(
        { template: "scout", config: { persona: "You are Scout. Only check Sui packages." } },
        catalog,
      ),
    ).toBe("Only check Sui packages.");
    expect(
      describeRemora({ template: "custom", config: { persona: "Watches the treasury." } }, null),
    ).toBe("Watches the treasury.");
  });

  it("falls back to the summary when nothing is left after the opening", () => {
    expect(
      describeRemora({ template: "scout", config: { persona: "You are Scout." } }, catalog),
    ).toBe("Answers questions by buying the best data.");
  });
});

describe("calendarDay", () => {
  it("reads a forecast day in UTC, whatever the browser's zone", () => {
    expect(calendarDay("2027-10-09")).toBe("Oct 9, 2027");
    expect(calendarDay("not a date")).toBe("not a date");
  });
});
