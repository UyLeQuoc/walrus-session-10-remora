import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  Amount,
  Checks,
  Empty,
  ExpiryBar,
  Flow,
  Meter,
  meterTone,
  Receipt,
  Ring,
  Spark,
  Stat,
  StatusDot,
  Steps,
  Timeline,
} from ".";

// Reduced motion: every piece must render its end state.
vi.mock("motion/react", async (orig) => ({
  ...(await orig<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

describe("Stat", () => {
  it("shows the number, its unit, its label and what it's measured against", () => {
    render(<Stat label="Spent today" value="0.42" unit="USDC" of="of 1.00" />);
    expect(screen.getByText("Spent today")).toBeDefined();
    expect(screen.getByText("0.42")).toBeDefined();
    expect(screen.getByText("USDC")).toBeDefined();
    expect(screen.getByText("of 1.00")).toBeDefined();
  });
});

describe("Meter and Ring", () => {
  it("turns amber at 80% and red at 100%", () => {
    expect(meterTone(0.5)).toBe("ok");
    expect(meterTone(0.8)).toBe("high");
    expect(meterTone(1)).toBe("over");
    expect(meterTone(1.4)).toBe("over");
  });

  it("is a named meter with its value, even past the limit", () => {
    render(<Meter value={120} max={100} label="Spent this month" left="1.20 of 1.00" />);
    const m = screen.getByRole("meter", { name: "Spent this month" });
    expect(m.getAttribute("aria-valuenow")).toBe("100");
    expect(m.getAttribute("aria-valuetext")).toBe("120%");
    expect(m.getAttribute("data-tone")).toBe("over");
  });

  it("draws a ring with the same reading", () => {
    render(<Ring value={30} max={100} label="This month" />);
    const r = screen.getByRole("meter", { name: "This month" });
    expect(r.getAttribute("aria-valuetext")).toBe("30%");
    expect(r.getAttribute("data-tone")).toBe("ok");
  });
});

describe("Flow", () => {
  it("lists every node in order, so the diagram reads without the picture", () => {
    render(
      <Flow
        label="Where the money goes"
        nodes={[
          { id: "you", label: "Your address" },
          { id: "limit", label: "Spending limit" },
          { id: "svc", label: "A paid service" },
        ]}
        active={1}
      />,
    );
    const list = screen.getByRole("list", { name: "Where the money goes" });
    expect(list.textContent).toMatch(/Your address.*Spending limit.*A paid service/);
  });
});

describe("Steps", () => {
  it("marks the steps done, the current one, and the rest", () => {
    render(
      <Steps
        label="Playground"
        current={1}
        steps={[{ label: "Start" }, { label: "Ask" }, { label: "Verify" }]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual(["done", "now", "next"]);
    expect(items[1]?.getAttribute("aria-current")).toBe("step");
    expect(screen.getByText("(done)")).toBeDefined();
  });
});

describe("Timeline", () => {
  it("names each event's kind for screen readers and shows its amount", () => {
    render(
      <Timeline
        label="Activity"
        items={[
          {
            id: "1",
            kind: "paid",
            title: "Sui risk check",
            amount: "0.01 USDC",
            at: new Date().toISOString(),
          },
          { id: "2", kind: "blocked", title: "Unknown payee", at: new Date().toISOString() },
        ]}
      />,
    );
    expect(screen.getByText("Paid")).toBeDefined();
    expect(screen.getByText("Blocked")).toBeDefined();
    expect(screen.getByText("0.01 USDC")).toBeDefined();
  });
});

describe("Receipt", () => {
  it("says whether it checks out", () => {
    const { rerender } = render(<Receipt amount="0.01" payee="Odds" verified />);
    expect(screen.getByText("Checks out on Sui")).toBeDefined();
    rerender(<Receipt amount="0.01" payee="Odds" verified={false} />);
    expect(screen.getByText("Doesn't check out")).toBeDefined();
    rerender(<Receipt amount="0.01" payee="Odds" verified={null} />);
    expect(screen.getByText("Checking")).toBeDefined();
  });
});

describe("Checks", () => {
  it("gives each check a word, not just a colour", () => {
    render(
      <Checks
        label="Safety layers"
        items={[
          { label: "Safety check", state: "pass" },
          { label: "Spending limit", state: "fail", detail: "Not an allowed payee" },
        ]}
      />,
    );
    expect(screen.getByText(": passed")).toBeDefined();
    expect(screen.getByText(": failed")).toBeDefined();
    expect(screen.getByText("Not an allowed payee")).toBeDefined();
  });
});

describe("the small pieces", () => {
  it("ExpiryBar says the days left", () => {
    render(<ExpiryBar days={20} />);
    expect(screen.getByRole("meter", { name: "20 days left on Walrus" })).toBeDefined();
  });

  it("Spark is an image with a label, and draws nothing without values", () => {
    const { container, rerender } = render(<Spark values={[1, 3, 2]} label="Score: 1 to 2" />);
    expect(screen.getByRole("img", { name: "Score: 1 to 2" })).toBeDefined();
    rerender(<Spark values={[]} label="none" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("StatusDot is labelled", () => {
    render(<StatusDot state="degraded" label="Tatum: degraded" />);
    expect(screen.getByRole("img", { name: "Tatum: degraded" }).getAttribute("data-state")).toBe(
      "degraded",
    );
  });

  it("Amount writes USDC one way", () => {
    render(<Amount value="15000" />);
    expect(screen.getByText("0.015")).toBeDefined();
  });

  it("Empty shows one line and one action", () => {
    render(
      <MemoryRouter>
        <Empty title="No remoras yet." action={<button type="button">New remora</button>} />
      </MemoryRouter>,
    );
    expect(screen.getByText("No remoras yet.")).toBeDefined();
    expect(screen.getByRole("button", { name: "New remora" })).toBeDefined();
  });
});
