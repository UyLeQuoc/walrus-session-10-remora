import { beforeEach, describe, expect, it, vi } from "vitest";

const streamText = vi.fn();

vi.mock("ai", () => ({
  streamText: (options: unknown) => streamText(options),
  stepCountIs: () => () => false,
}));

import { runTurn } from "./agent.ts";

describe("runTurn", () => {
  beforeEach(() => {
    streamText.mockClear();
  });

  it("hands the caller's abort signal to the model stream", () => {
    const abortSignal = new AbortController().signal;
    runTurn(
      {
        model: { id: "m", primary: {} as never, fallback: null },
        port: { scope: { mode: "guest" } } as never,
        messages: [{ role: "user", content: "hi" }],
        channel: "web",
        userHandle: "mai",
        memoryEnabled: false,
        abortSignal,
      },
      { injected: [], styleHints: [] },
    );
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ abortSignal }));
  });

  it("puts an attached file just before the person's last message", () => {
    runTurn(
      {
        model: { id: "m", primary: {} as never, fallback: null },
        port: { scope: { mode: "owned" } } as never,
        messages: [
          { role: "user", content: "earlier" },
          { role: "assistant", content: "ok" },
          { role: "user", content: "what port?" },
        ],
        channel: "web",
        userHandle: "mai",
        memoryEnabled: false,
        document: { name: "notes.md", text: "port 5433" },
      },
      { injected: [], styleHints: [] },
    );
    const call = streamText.mock.calls.at(-1)?.[0] as {
      messages: Array<{ role: string; content: string }>;
      system: string;
    };
    const roles = call.messages.map((m) => m.content.slice(0, 20));
    expect(call.messages.at(-1)?.content).toBe("what port?");
    expect(call.messages.at(-2)?.content).toMatch(/BEGIN_UNTRUSTED_FILE_[0-9a-f]{32}/);
    expect(call.messages.at(-2)?.content).toContain("1| port 5433");
    expect(roles[0]).toBe("earlier");
    expect(call.system).toMatch(/FILE:/);
  });
});
