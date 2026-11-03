import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import type { Line } from "@/features/threads/lines";
import { threadMood } from "@/features/threads/thread-page";
import { RemoraAvatar, remoraMood } from "./remora-avatar";

function face(node: ReactElement) {
  const { container } = render(node);
  return container.querySelector('[data-slot="remora-avatar"]') as HTMLElement;
}

describe("RemoraAvatar (ADR-0098)", () => {
  it("keeps the same shape and tint for the same id, and shows its mood", () => {
    const a = face(<RemoraAvatar id="r-1" mood="success" />);
    const b = face(<RemoraAvatar id="r-1" mood="error" />);
    expect(a.dataset.shape).toBe(b.dataset.shape);
    expect(a.dataset.tint).toBe(b.dataset.tint);
    expect(a.dataset.mood).toBe("success");
    expect(b.dataset.mood).toBe("error");
    expect(a.getAttribute("aria-hidden")).toBe("true");
  });

  it("spreads ids over every shape", () => {
    const shapes = new Set(
      Array.from(
        { length: 200 },
        (_, i) => face(<RemoraAvatar id={`remora-${i}`} />).dataset.shape,
      ),
    );
    expect([...shapes].sort()).toEqual(["dome", "drop", "peak", "pebble", "squircle"]);
  });

  it("draws the thought only when the face is big enough to read it", () => {
    expect(
      face(<RemoraAvatar id="r" mood="thinking" size={36} />).querySelector(".rf-puff"),
    ).not.toBeNull();
    expect(
      face(<RemoraAvatar id="r" mood="thinking" size={20} />).querySelector(".rf-puff"),
    ).toBeNull();
  });

  it("keeps the alert badge at any size", () => {
    expect(
      face(<RemoraAvatar id="r" mood="alert" size={17} />).querySelector(".rf-badge"),
    ).not.toBeNull();
  });

  it("stops moving when it's still", () => {
    expect(face(<RemoraAvatar id="r" still />).className).toContain("remora-face-still");
  });
});

describe("remoraMood", () => {
  it.each([
    [{ status: "active", template: "scout" }, 0, "idle"],
    [{ status: "active", template: "sentinel" }, 0, "listening"],
    [{ status: "shadow", template: "scout" }, 0, "listening"],
    [{ status: "creating", template: "scout" }, 0, "thinking"],
    [{ status: "paused", template: "scout" }, 0, "asleep"],
    [{ status: "retired", template: "scout" }, 0, "off"],
    [{ status: "active", template: "scout" }, 2, "alert"],
    [{ status: "paused", template: "scout" }, 1, "alert"],
  ] as const)("%o with %i approvals waiting looks %s", (r, waiting, mood) => {
    expect(remoraMood(r, waiting)).toBe(mood);
  });
});

describe("threadMood", () => {
  const r = { status: "active", template: "scout" };
  const now = Date.parse("2026-11-02T10:00:00Z");
  const line = (type: Line["type"], secondsAgo: number) =>
    ({ type, createdAt: new Date(now - secondsAgo * 1000).toISOString() }) as Line;

  it("thinks while it answers", () => {
    expect(threadMood(r, true, line("blocked", 1), now)).toBe("thinking");
  });

  it("shows what just happened for a minute", () => {
    expect(threadMood(r, false, line("blocked", 5), now)).toBe("error");
    expect(threadMood(r, false, line("payment", 5), now)).toBe("success");
    expect(threadMood(r, false, line("approval_needed", 5), now)).toBe("alert");
  });

  it("goes back to where it stands after that", () => {
    expect(threadMood(r, false, line("blocked", 120), now)).toBe("idle");
    expect(threadMood(r, false, undefined, now)).toBe("idle");
  });
});
