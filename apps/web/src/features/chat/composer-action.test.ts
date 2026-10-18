import { describe, expect, it, vi } from "vitest";
import { applyComposerAction } from "./composer-action";

describe("applyComposerAction", () => {
  it("stops the current reply and does not send another", () => {
    const send = vi.fn();
    const stop = vi.fn();
    applyComposerAction({ busy: true, text: "hello", send, stop });
    expect(stop).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
  });

  it("sends when nothing is in flight", () => {
    const send = vi.fn();
    const stop = vi.fn();
    applyComposerAction({ busy: false, text: "hello", send, stop });
    expect(send).toHaveBeenCalledWith("hello");
    expect(stop).not.toHaveBeenCalled();
  });
});
