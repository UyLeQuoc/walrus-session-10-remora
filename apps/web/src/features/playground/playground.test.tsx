/**
 * U8 pages on a fake API built from the contract fixtures: the playground (start, ask, the question
 * limit, a resting playground) and the `/lab/health` board.
 */
import { HealthReport, PlaygroundSession } from "@remora/schema";
import healthJson from "@remora/schema/fixtures/health.report.json";
import sessionJson from "@remora/schema/fixtures/playground.session.json";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthBoard } from "@/features/lab/health-board";
import { lasts, PlaygroundPage } from "./playground-page";

const session = PlaygroundSession.parse(sessionJson);
const health = HealthReport.parse(healthJson);
const open = { open: true, reason: null, limits: session.limits, network: "testnet" };

function fakeApi(answers: Record<string, unknown | ((body: unknown) => unknown)>) {
  const calls: { method: string; url: string; body: unknown; token: string | null }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({
        method,
        url,
        body,
        token: new Headers(init?.headers).get("x-remora-playground"),
      });
      const hit = answers[`${method} ${url}`];
      if (hit === undefined)
        return Response.json(
          { error: { code: "x", message: "That playground session is gone." } },
          { status: 404 },
        );
      const value = typeof hit === "function" ? hit(body) : hit;
      return value instanceof Response ? value : Response.json(value);
    }),
  );
  return calls;
}

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("playground (H7)", () => {
  it("starts a session, then asks with its token and shows the paid answer and the spend", async () => {
    const fresh = { ...session, answers: [], spentUsdc: "0.00", questionsLeft: 3 };
    const calls = fakeApi({
      "GET /api/playground": open,
      "POST /api/playground/session": { session: fresh, token: "tok-1" },
      "POST /api/playground/ask": { session: { ...session, questionsLeft: 2 } },
    });
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("playground-intro")).textContent).toContain("1.00 USDC");
    await userEvent.click(screen.getByRole("button", { name: /Start my Researcher/ }));
    expect((await screen.findByTestId("playground-spent")).textContent).toBe("0.00 of 1.00 USDC");
    await userEvent.click(screen.getByRole("button", { name: /Ask Researcher/ }));
    expect((await screen.findByTestId("playground-answer")).textContent).toContain(
      "Paid 0.01 USDC to Sui risk check",
    );
    expect(screen.getByRole("link", { name: /Check its receipt/ }).getAttribute("href")).toBe(
      session.answers[0]?.verify,
    );
    expect(screen.getByTestId("playground-questions").textContent).toBe("2");
    expect(calls.find((c) => c.url === "/api/playground/ask")?.token).toBe("tok-1");
  });

  it("says plainly when the questions are used up, and when the playground is resting", async () => {
    localStorage.setItem("remora.playground", "tok-2");
    fakeApi({
      "GET /api/playground": open,
      "GET /api/playground/session": { session: { ...session, questionsLeft: 0 } },
    });
    const { unmount } = render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("That was your last question")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Ask Researcher/ })).toBeNull();
    unmount();
    localStorage.removeItem("remora.playground");
    fakeApi({
      "GET /api/playground": {
        ...open,
        open: false,
        reason: "The playground is resting while its wallet is topped up.",
      },
    });
    render(
      <MemoryRouter>
        <PlaygroundPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/resting/)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: /Start my Researcher/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("lab health (K2)", () => {
  it("shows every item with its status and fix, and the recent errors", async () => {
    fakeApi({ "GET /api/health/deep": health });
    render(
      <MemoryRouter>
        <HealthBoard />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("health-item")).toHaveLength(health.items.length),
    );
    const budget = screen
      .getAllByTestId("health-item")
      .find((i) => i.textContent?.includes("relayer budget"));
    expect(budget?.dataset.status).toBe("degraded");
    expect(budget?.textContent).toContain("Fix: Wait for the hourly budget");
    expect(screen.getByTestId("health-status").textContent).toBe("degraded");
    expect(screen.getByLabelText("Recent errors").textContent).toContain("relayer.slow");
  });
});

describe("lasts", () => {
  it("says minutes for a short session and hours for a long one", () => {
    expect(lasts(3)).toBe("3 minutes");
    expect(lasts(1440)).toBe("24 hours");
  });
});
