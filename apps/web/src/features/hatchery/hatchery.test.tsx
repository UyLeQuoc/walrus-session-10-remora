/**
 * U7 pages (ADR-0046, ADR-0048) on a fake API built from the contract fixtures: share → publish with
 * one signature, the gallery, the consent screen and a one-signature hatch, Proof of Learning and the
 * learning charts, and the memory controls. Wallets are stubbed; the e2e suite signs for real.
 */

import { Transaction } from "@mysten/sui/transactions";
import {
  HatchConsent,
  HatcheryListing,
  InspectorResponse,
  LearningSeries,
  ProofOfLearning,
  ShareReview,
} from "@remora/schema";
import consentJson from "@remora/schema/fixtures/hatchery.consent.json";
import listingsJson from "@remora/schema/fixtures/hatchery.listings.json";
import blockJson from "@remora/schema/fixtures/hatchery.safety-block.json";
import reviewJson from "@remora/schema/fixtures/hatchery.share-review.json";
import inspectorJson from "@remora/schema/fixtures/inspector.json";
import seriesJson from "@remora/schema/fixtures/learning-series.json";
import proofJson from "@remora/schema/fixtures/proof-of-learning.json";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { LearningSection } from "@/features/learning/learning";
import { MemoryInspectorPage } from "@/features/memory-inspector/memory-page";
import { FIXTURE_SCOUT } from "@/features/remoras/fixtures";
import { HatcheryPage } from "./gallery-page";
import { SharePage } from "./share-page";
import { TemplatePage } from "./template-page";

const OWNER = `0x${"3d".repeat(32)}`;
const review = ShareReview.parse(reviewJson);
const [listing] = z.array(HatcheryListing).parse(listingsJson);
const consent = HatchConsent.parse(consentJson);
const proof = ProofOfLearning.parse(proofJson);
const series = z.array(LearningSeries).parse(seriesJson);
const TPL = listing?.templateId ?? "";
let account: { address: string; chains: string[] } | null = null;
const run = vi.fn(async () => ({ digest: "DgHatch111111111111111111111111111111" }));

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => account,
  useSuiClient: () => ({
    core: {
      waitForTransaction: async () => ({ Transaction: { effects: { status: { success: true } } } }),
    },
  }),
  useSignAndExecuteTransaction: () => ({ mutateAsync: run }),
  useWallets: () => [],
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useCurrentWallet: () => ({ currentWallet: null, isConnected: false }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
  useSignTransaction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const at = (path: string, routePath: string, element: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

async function tx() {
  const t = new Transaction();
  t.setSender(OWNER);
  return t.toJSON();
}

function fakeApi(answers: Record<string, unknown>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const [path, query = ""] = String(input).split("?");
      const method = init?.method ?? "GET";
      calls.push({
        method,
        url: `${path}${query ? `?${query}` : ""}`,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      const hit = answers[`${method} ${path}`];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit);
    }),
  );
  return calls;
}

const signedIn = { "GET /api/me": { mode: "owned", signedIn: true, walletAddress: OWNER } };

beforeEach(() => {
  account = { address: OWNER, chains: ["sui:testnet"] };
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  run.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("share (M1, M3)", () => {
  it("shows what would be shared, then publishes with one signature", async () => {
    const calls = fakeApi({
      ...signedIn,
      [`POST /api/remoras/${FIXTURE_SCOUT.id}/share`]: { review },
      "POST /api/hatchery/publish": {
        transaction: await tx(),
        blobId: listing?.blobId,
        safety: review.safety,
      },
      "POST /api/hatchery/publish/confirm": {
        listing,
        links: { url: `http://web/hatchery/${TPL}`, telegram: null },
      },
    });
    at(`/remoras/${FIXTURE_SCOUT.id}/share`, "/remoras/:id/share", <SharePage />);
    expect((await screen.findByTestId("share-file")).textContent).toContain("remora.team/v1");
    expect(screen.getByTestId("safety-report").dataset.verdict).toBe("pass");
    expect(screen.getByLabelText("Removed").textContent).toContain("memories");
    await userEvent.click(screen.getByRole("button", { name: /Publish as a template/ }));
    await waitFor(() => expect(screen.getByText("elsewhere")).toBeDefined());
    expect(run).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.url === "/api/hatchery/publish")?.body).toEqual({
      markdown: review.markdown,
    });
  });

  it("won't publish what the review blocked", async () => {
    fakeApi({
      ...signedIn,
      [`POST /api/remoras/${FIXTURE_SCOUT.id}/share`]: {
        review: { ...review, safety: blockJson },
      },
    });
    at(`/remoras/${FIXTURE_SCOUT.id}/share`, "/remoras/:id/share", <SharePage />);
    expect((await screen.findByTestId("safety-report")).dataset.verdict).toBe("block");
    expect(
      (screen.getByRole("button", { name: /Publish as a template/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("gallery and hatch (M4, M5)", () => {
  it("lists templates and searches them", async () => {
    const calls = fakeApi({ "GET /api/hatchery": { templates: [listing] } });
    at("/hatchery", "/hatchery", <HatcheryPage />);
    const card = await screen.findByTestId("hatchery-card");
    expect(card.textContent).toContain("Package checker");
    expect(within(card).getByTestId("fork-count").textContent?.trim()).toBe("1");
    await userEvent.type(screen.getByLabelText("Search templates"), "pack");
    await waitFor(() => expect(calls.some((c) => c.url === "/api/hatchery?q=pack")).toBe(true));
  });

  it("shows the consent screen and hatches with one signature", async () => {
    const calls = fakeApi({
      ...signedIn,
      [`GET /api/hatchery/${TPL}`]: {
        listing,
        links: { url: `http://web/hatchery/${TPL}`, telegram: "https://t.me/bot?start=tpl_x" },
        markdown: review.markdown,
      },
      [`GET /api/hatchery/${TPL}/consent`]: { consent },
      [`POST /api/hatchery/${TPL}/hatch`]: {
        transaction: await tx(),
        remoras: [FIXTURE_SCOUT.id],
        roomId: "4f3e2d1c-0b9a-4876-8543-210fedcba987",
        skipped: [],
      },
      [`POST /api/hatchery/${TPL}/hatch/confirm`]: {
        confirmed: [FIXTURE_SCOUT.id],
        remoras: [FIXTURE_SCOUT.id],
      },
    });
    at(`/hatchery/${TPL}`, "/hatchery/:id", <TemplatePage />);
    const consentBox = await screen.findByTestId("consent");
    await waitFor(() =>
      expect(within(consentBox).getByLabelText("Services it may pay").textContent).toContain(
        "0.01 USDC a call",
      ),
    );
    expect(screen.getByTestId("template-blob").textContent).toContain(listing?.blobId);
    await userEvent.click(await screen.findByRole("button", { name: /Use it \(one signature\)/ }));
    await waitFor(() => expect(screen.getByText("elsewhere")).toBeDefined());
    expect(run).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.url.endsWith("/hatch/confirm"))?.body).toEqual({
      digest: "DgHatch111111111111111111111111111111",
      remoraIds: [FIXTURE_SCOUT.id],
    });
  });

  it("can't hatch a blocked template", async () => {
    fakeApi({
      ...signedIn,
      [`GET /api/hatchery/${TPL}`]: { listing, links: { url: "x", telegram: null }, markdown: "" },
      [`GET /api/hatchery/${TPL}/consent`]: { consent: { ...consent, safety: blockJson } },
    });
    at(`/hatchery/${TPL}`, "/hatchery/:id", <TemplatePage />);
    const button = await screen.findByRole("button", { name: /Use it/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("learning (G5, L1)", () => {
  it("shows the proof with its memory delta and each series' latest value", async () => {
    fakeApi({
      [`GET /api/remoras/${proof.remoraId}/learning`]: { series: [series[0]] },
      [`GET /api/remoras/${proof.remoraId}/proofs`]: { proofs: [proof] },
    });
    render(
      <MemoryRouter>
        <LearningSection remoraId={proof.remoraId} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("proof-delta")).textContent).toContain(
      "Ignore incoming SUI under 0.01",
    );
    expect(screen.getByTestId("proof").textContent).toContain("Pinged you");
    expect(screen.getByTestId("learning-latest").textContent).toBe("0%");
  });
});

describe("memory controls (F4, F5, F8)", () => {
  it("hides a memory, flags expiry and offers export", async () => {
    const inspector = InspectorResponse.parse(inspectorJson);
    const calls = fakeApi({
      ...signedIn,
      "GET /api/remoras": { remoras: [FIXTURE_SCOUT] },
      [`GET /api/remoras/${FIXTURE_SCOUT.id}/memory`]: {
        ...inspector,
        rows: inspector.rows.map((r) => ({ ...r, expiresSoon: true })),
      },
      [`POST /api/remoras/${FIXTURE_SCOUT.id}/memory/hide`]: {
        blobId: inspector.rows[0]?.blobId,
        hidden: true,
      },
    });
    at("/memory", "/memory", <MemoryInspectorPage />);
    expect((await screen.findByTestId("expiry-alert")).textContent).toContain(
      "expires within 30 days",
    );
    expect(screen.getByRole("button", { name: /Export Markdown/ })).toBeDefined();
    const row = (await screen.findAllByTestId("memory-row"))[0];
    if (!row) throw new Error("no row");
    await userEvent.click(within(row).getByRole("button", { name: /^Hide / }));
    await waitFor(() =>
      expect(calls.find((c) => c.url.endsWith("/memory/hide"))?.body).toEqual({
        blobId: inspector.rows[0]?.blobId,
        namespace: inspector.rows[0]?.namespace,
        hidden: true,
      }),
    );
  });
});
