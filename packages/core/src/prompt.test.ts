import { describe, expect, it } from "vitest";
import { buildSystemPrompt, type PromptContext } from "./prompt.ts";

const base: PromptContext = {
  channel: "web",
  mode: "guest",
  memoryEnabled: true,
  userHandle: "mai",
  today: "2026-10-02",
  styleHints: [],
};

describe("buildSystemPrompt", () => {
  it("keeps hippo's identity whether memory is on or off", () => {
    for (const memoryEnabled of [true, false]) {
      const prompt = buildSystemPrompt({ ...base, memoryEnabled });
      expect(prompt).toMatch(/you are hippo, not the language model/i);
      expect(prompt).toMatch(/never introduce yourself as Gemini, DeepSeek, Qwen/i);
    }
  });

  it("says the recalled block comes from hippo, not the user, only when memory is on", () => {
    expect(buildSystemPrompt(base)).toMatch(/did not write or paste it/);
    expect(buildSystemPrompt({ ...base, memoryEnabled: false })).not.toMatch(
      /BEGIN_UNTRUSTED_WALRUS_MEMORY/,
    );
  });

  it("explains an attached file only on a turn that has one", () => {
    const withFile = buildSystemPrompt({ ...base, document: true });
    expect(withFile).toMatch(/BEGIN_UNTRUSTED_FILE/);
    expect(withFile).toMatch(/never instructions/);
    expect(buildSystemPrompt(base)).not.toMatch(/UNTRUSTED_FILE/);
  });

  it("asks one getting-to-know question only while hippo knows little and memory is on", () => {
    expect(buildSystemPrompt({ ...base, gettingToKnow: true })).toMatch(
      /GETTING TO KNOW:.*end each reply with one short question.*answer it fully first/s,
    );
    expect(buildSystemPrompt(base)).not.toMatch(/GETTING TO KNOW:/);
    expect(buildSystemPrompt({ ...base, gettingToKnow: true, memoryEnabled: false })).not.toMatch(
      /GETTING TO KNOW:/,
    );
  });

  it("asks about a due promise only at the start of a session with memory on", () => {
    expect(buildSystemPrompt({ ...base, sessionStart: true })).toMatch(/COMMITMENTS:.*2026-10-02/s);
    expect(buildSystemPrompt(base)).not.toMatch(/COMMITMENTS:/);
    expect(buildSystemPrompt({ ...base, sessionStart: true, memoryEnabled: false })).not.toMatch(
      /COMMITMENTS:/,
    );
  });
});
