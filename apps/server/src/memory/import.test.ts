import type { ImportedFact } from "@remora/core/import-facts";
import { describe, expect, it, vi } from "vitest";
import { findImportFacts, keepImportedFacts } from "./import.ts";
import type { RememberFactResult } from "./remember-fact.ts";

describe("findImportFacts", () => {
  it("sends the note fenced and returns only typed lines", async () => {
    const complete = vi.fn(
      async (_request: { system: string; prompt: string }) =>
        "Sure!\nprofile: I write TypeScript.\nsecret: hunter2",
    );
    const facts = await findImportFacts("You write TypeScript.", "2026-10-02", complete);
    expect(facts).toEqual([{ type: "profile", text: "I write TypeScript." }]);
    expect(complete.mock.calls[0]?.[0]?.prompt).toMatch(/^BEGIN_PASTED_/);
  });
});

describe("keepImportedFacts", () => {
  it("counts new, known and failed writes, and keeps going after a failure", async () => {
    const facts: ImportedFact[] = [
      { type: "profile", text: "new one" },
      { type: "style", text: "known one" },
      { type: "decision", text: "throws" },
      { type: "gotcha", text: "refused" },
    ];
    const outcomes: Record<string, () => Promise<RememberFactResult>> = {
      "new one": async () => ({ ok: true, saved: true, note: "" }),
      "known one": async () => ({ ok: true, saved: false, note: "" }),
      throws: async () => {
        throw new Error("relayer");
      },
      refused: async () => ({ ok: false, reason: "text" }),
    };
    const remember = vi.fn((fact: ImportedFact) => {
      const outcome = outcomes[fact.text];
      if (!outcome) throw new Error(`unexpected ${fact.text}`);
      return outcome();
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await keepImportedFacts(facts, remember)).toEqual({ saved: 1, known: 1, failed: 2 });
    expect(remember).toHaveBeenCalledTimes(4);
  });
});
