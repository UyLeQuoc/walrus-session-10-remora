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
});
