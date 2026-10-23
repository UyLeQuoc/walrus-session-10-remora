/**
 * N20: the public status page on a fake API. It needs no wallet and no session.
 */
import type { HealthReport } from "@remora/schema";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatusPage } from "./status-page";

const okReport: HealthReport = {
  status: "ok",
  checkedAt: "2026-10-23T10:00:00.000Z",
  errors: [],
  items: [
    {
      name: "Walrus storage",
      status: "ok",
      detail: "Reachable",
      value: null,
      threshold: null,
      fix: null,
    },
    {
      name: "Sui gRPC",
      status: "ok",
      detail: "Answering within budget",
      value: 42,
      threshold: 500,
      fix: null,
    },
  ],
};

const downReport: HealthReport = {
  ...okReport,
  status: "down",
  items: [
    {
      name: "Walrus storage",
      status: "down",
      detail: "Upload failing",
      value: null,
      threshold: null,
      fix: "Restart the relayer",
    },
  ],
};

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

function fakeHealth(body: HealthReport) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(body)),
  );
}

describe("status page (N20)", () => {
  it("shows the overall line and the items when everything is ok", async () => {
    fakeHealth(okReport);
    render(<StatusPage />);

    const overall = await screen.findByTestId("status-overall");
    expect(overall.textContent).toContain("All systems operational");
    expect(overall.dataset.status).toBe("ok");

    const items = screen.getAllByTestId("status-item");
    expect(items).toHaveLength(2);
    expect(screen.getByText("Walrus storage")).toBeDefined();
    expect(screen.getByText("Answering within budget")).toBeDefined();
  });

  it("shows Major outage when the report is down, and hides the fix text", async () => {
    fakeHealth(downReport);
    render(<StatusPage />);

    await waitFor(() =>
      expect(screen.getByTestId("status-overall").textContent).toContain("Major outage"),
    );
    expect(screen.getByTestId("status-overall").dataset.status).toBe("down");
    expect(screen.getByTestId("status-item").dataset.status).toBe("down");
    expect(screen.queryByText("Restart the relayer")).toBeNull();
  });

  it("shows Status unavailable and no raw error text when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch secret-host.internal");
      }),
    );
    render(<StatusPage />);

    expect(await screen.findByText("Status unavailable")).toBeDefined();
    expect(
      screen.getByText("We could not reach the status check. Try again in a minute."),
    ).toBeDefined();
    expect(screen.queryByText(/secret-host/)).toBeNull();
  });
});
