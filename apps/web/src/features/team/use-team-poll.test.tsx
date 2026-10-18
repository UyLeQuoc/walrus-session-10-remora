import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TeamMemory } from "@/hooks/use-team";
import { POLL_EVERY_MS, POLL_FOR_MS } from "./team-poll";
import { useTeamPoll } from "./use-team-poll";

function row(status: TeamMemory["status"]): TeamMemory {
  return {
    id: status,
    type: "decision",
    status,
    createdAt: new Date().toISOString(),
    blobId: null,
    explorerUrl: null,
    mine: true,
  };
}

function Probe({ memories, reload }: { memories: TeamMemory[]; reload: () => Promise<void> }) {
  useTeamPoll(memories, reload);
  return null;
}

describe("useTeamPoll", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reloads every five seconds while a row is pending, and stops once none is", () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});
    const view = render(<Probe memories={[row("pending")]} reload={reload} />);
    act(() => {
      vi.advanceTimersByTime(POLL_EVERY_MS * 2);
    });
    expect(reload).toHaveBeenCalledTimes(2);

    view.rerender(<Probe memories={[row("stored")]} reload={reload} />);
    act(() => {
      vi.advanceTimersByTime(POLL_EVERY_MS * 3);
    });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("gives up after the window even if a row never settles", () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});
    render(<Probe memories={[row("pending")]} reload={reload} />);
    act(() => {
      vi.advanceTimersByTime(POLL_FOR_MS * 2);
    });
    expect(reload).toHaveBeenCalledTimes(POLL_FOR_MS / POLL_EVERY_MS - 1);
  });

  it("stops when the page goes away", () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});
    const view = render(<Probe memories={[row("pending")]} reload={reload} />);
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(POLL_EVERY_MS * 3);
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not poll when nothing is pending", () => {
    vi.useFakeTimers();
    const reload = vi.fn(async () => {});
    render(<Probe memories={[row("stored"), row("failed")]} reload={reload} />);
    act(() => {
      vi.advanceTimersByTime(POLL_EVERY_MS * 3);
    });
    expect(reload).not.toHaveBeenCalled();
  });
});
