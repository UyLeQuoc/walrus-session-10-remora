import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each([
    ["active", "success"],
    ["live", "success"],
    ["paid", "success"],
    ["verified", "success"],
    ["shadow", "warning"],
    ["pending", "warning"],
    ["creating", "warning"],
    ["paused", "outline"],
    ["retired", "outline"],
    ["failed", "destructive"],
  ] as const)("maps %s to the %s variant and keeps its word", (status, variant) => {
    render(<StatusBadge status={status} />);
    const badge = screen.getByText(status === "shadow" ? "practice" : status);
    expect(badge.getAttribute("data-variant")).toBe(variant);
  });

  it("says practice for a remora in shadow mode (ADR-0094)", () => {
    render(<StatusBadge status="shadow" />);
    expect(screen.queryByText("shadow")).toBeNull();
    expect(screen.getByText("practice")).toBeDefined();
  });
});
