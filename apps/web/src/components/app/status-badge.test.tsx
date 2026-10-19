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
    const badge = screen.getByText(status);
    expect(badge.getAttribute("data-variant")).toBe(variant);
  });
});
