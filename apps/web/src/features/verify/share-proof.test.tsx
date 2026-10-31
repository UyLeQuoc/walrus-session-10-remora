/**
 * H5: share a Wake as a public proof link, and the public page, on a fake API.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import remoraScout from "../../../../../packages/schema/fixtures/remora-view.scout.json";
import verifyResult from "../../../../../packages/schema/fixtures/verify-result.payment.json";
import wakeView from "../../../../../packages/schema/fixtures/wake-view.payment.json";
import { WhyButton } from "../remoras/why-drawer";
import { PublicWake } from "./public-wake";
import { PUBLIC_WAKE, SHARE_LINK } from "./public-wake.fixture";
import { PublicWakePage } from "./public-wake-page";
import { ShareControl } from "./share-control";
import { VerifyPage } from "./verify-page";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

let owner: string | null = null;
vi.mock("@/features/remoras/hooks", async (orig) => ({
  ...(await orig<typeof import("@/features/remoras/hooks")>()),
  useOwner: () => ({ owner, loading: false, reload: () => {} }),
}));

const WAKE_ID = "9a7e1c44-0f1d-4f9a-8d55-3b2a1c0d9e88";
const OWNER = `0x${"11".repeat(32)}`;

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function fakeApi(handler: Handler) {
  const calls: Array<{ method: string; url: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ method: init?.method ?? "GET", url });
      return handler(url, init);
    }),
  );
  return calls;
}

const writeText = vi.fn(async (_v: string) => {});

beforeEach(() => {
  owner = null;
  toast.success.mockReset();
  toast.error.mockReset();
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
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

function wrap(ui: React.ReactNode, at = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const shareRoutes: Handler = (url, init) => {
  if (url.endsWith(`/api/wakes/${WAKE_ID}/share`))
    return init?.method === "DELETE" ? Response.json({ ok: true }) : Response.json(SHARE_LINK);
  return new Response("{}", { status: 404 });
};

describe("ShareControl", () => {
  it("confirms what becomes public, shows the link, copies it, and stops sharing", async () => {
    const calls = fakeApi(shareRoutes);
    wrap(<ShareControl wakeId={WAKE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Share proof" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("without signing in");
    expect(dialog.textContent).toContain("will not see your messages");
    expect(calls).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Create public link" }));
    const field = (await screen.findByLabelText("Public link")) as HTMLInputElement;
    expect(field.value).toBe(SHARE_LINK.url);
    expect(calls[0]).toEqual({ method: "POST", url: `/api/wakes/${WAKE_ID}/share` });

    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(SHARE_LINK.url));

    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    const stop = await screen.findByRole("alertdialog");
    fireEvent.click(within(stop).getByRole("button", { name: "Stop sharing" }));
    await waitFor(() => expect(screen.queryByLabelText("Public link")).toBeNull());
    expect(calls.at(-1)).toEqual({ method: "DELETE", url: `/api/wakes/${WAKE_ID}/share` });
    expect(screen.getByRole("button", { name: "Share proof" })).toBeDefined();
  });

  it("keeps the error in the dialog when sharing fails, and shows no link", async () => {
    fakeApi(() => Response.json({ error: "Only the owner can share this." }, { status: 403 }));
    wrap(<ShareControl wakeId={WAKE_ID} />);

    fireEvent.click(screen.getByRole("button", { name: "Share proof" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Create public link" }));
    expect(await within(dialog).findByText("Only the owner can share this.")).toBeDefined();
    expect(screen.queryByLabelText("Public link")).toBeNull();
  });
});

describe("ShareControl revoke error", () => {
  it("keeps the link and shows the error in the dialog when stopping fails", async () => {
    fakeApi((url, init) =>
      init?.method === "DELETE"
        ? Response.json({ error: "Couldn't stop sharing. Try again." }, { status: 500 })
        : shareRoutes(url, init),
    );
    wrap(<ShareControl wakeId={WAKE_ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Share proof" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Create public link",
      }),
    );
    await screen.findByLabelText("Public link");

    fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));
    const stop = await screen.findByRole("alertdialog");
    fireEvent.click(within(stop).getByRole("button", { name: "Stop sharing" }));
    expect(await within(stop).findByText("Couldn't stop sharing. Try again.")).toBeDefined();
    expect(screen.getByLabelText("Public link")).toBeDefined();
  });
});

describe("Share on /verify/:ref", () => {
  const routes: Handler = (url, init) => {
    if (url.includes("/api/verify/")) return Response.json(verifyResult);
    if (url.endsWith("/api/remoras")) return Response.json({ remoras: [remoraScout] });
    return shareRoutes(url, init);
  };
  const page = () =>
    wrap(
      <Routes>
        <Route path="/verify/:ref" element={<VerifyPage />} />
      </Routes>,
      "/verify/8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ",
    );

  it("offers Share to the owner of the Wake's remora", async () => {
    owner = OWNER;
    fakeApi(routes);
    page();
    expect(await screen.findByRole("button", { name: "Share proof" })).toBeDefined();
  });

  it("does not offer it signed out or to someone else", async () => {
    fakeApi(routes);
    page();
    await screen.findByTestId("verify-verdict");
    expect(screen.queryByRole("button", { name: "Share proof" })).toBeNull();

    owner = OWNER;
    fakeApi((url, init) =>
      url.endsWith("/api/remoras")
        ? Response.json({ remoras: [{ ...remoraScout, address: `0x${"aa".repeat(32)}` }] })
        : routes(url, init),
    );
    page();
    await waitFor(() => expect(screen.getAllByTestId("verify-verdict")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Share proof" })).toBeNull();
  });
});

describe("Share in the Why? panel", () => {
  const why = {
    event: {
      id: "5b0c1d2e-0000-4000-8000-000000000001",
      remoraId: remoraScout.id,
      network: "testnet",
      type: "payment",
      summary: "Paid sui-risk $0.05",
      payload: {},
      receiptId: WAKE_ID,
      feedback: null,
      createdAt: "2026-11-03T02:13:05Z",
    },
    remora: "scout",
    wake: {
      id: WAKE_ID,
      intentHash: wakeView.intentHash,
      txDigest: wakeView.wake.result.tx,
      anchored: true,
      wakeBlobId: null,
      wake: wakeView.wake,
    },
  };
  const routes =
    (remoras: unknown[]): Handler =>
    (url, init) =>
      url.includes("/why")
        ? Response.json(why)
        : url.includes("/proofs")
          ? Response.json({ proofs: [] })
          : url.endsWith("/api/remoras")
            ? Response.json({ remoras })
            : shareRoutes(url, init);
  const open = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    await screen.findByText("Decision");
  };

  it("shows Share to the owner of the Wake's remora", async () => {
    owner = OWNER;
    fakeApi(routes([remoraScout]));
    wrap(<WhyButton eventId={why.event.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Why?" }));
    expect(await screen.findByRole("button", { name: "Share proof" })).toBeDefined();
  });

  it("hides Share when signed out", async () => {
    fakeApi(routes([remoraScout]));
    wrap(<WhyButton eventId={why.event.id} />);
    await open();
    expect(screen.queryByRole("button", { name: "Share proof" })).toBeNull();
  });

  it("hides Share from a signed-in user who does not own the remora", async () => {
    owner = OWNER;
    fakeApi(routes([{ ...remoraScout, address: `0x${"aa".repeat(32)}` }]));
    wrap(<WhyButton eventId={why.event.id} />);
    await open();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole("button", { name: "Share proof" })).toBeNull();
  });

  it("does not show Share while ownership is still loading", async () => {
    owner = OWNER;
    let release: (r: Response) => void = () => {};
    const pending = new Promise<Response>((r) => {
      release = r;
    });
    fakeApi((url, init) => (url.endsWith("/api/remoras") ? pending : routes([])(url, init)));
    wrap(<WhyButton eventId={why.event.id} />);
    await open();
    expect(screen.queryByRole("button", { name: "Share proof" })).toBeNull();
    release(Response.json({ remoras: [remoraScout] }));
    expect(await screen.findByRole("button", { name: "Share proof" })).toBeDefined();
  });
});

describe("PublicWake schema", () => {
  it("strips unknown keys, at the top level and inside checks and the action", () => {
    const out = PublicWake.parse({
      ...PUBLIC_WAKE,
      prompt: "SECRET",
      action: { ...PUBLIC_WAKE.action, reason: "SECRET" },
      checks: PUBLIC_WAKE.checks.map((c) => ({ ...c, raw: "SECRET" })),
    });
    expect(JSON.stringify(out)).not.toContain("SECRET");
    expect(out).toEqual(PUBLIC_WAKE);
  });

  it("rejects over-long free text", () => {
    const check = (c: object) =>
      PublicWake.safeParse({ ...PUBLIC_WAKE, checks: [{ name: "x", ok: true, detail: "", ...c }] });
    expect(check({ detail: "d".repeat(200) }).success).toBe(true);
    expect(check({ detail: "d".repeat(201) }).success).toBe(false);
    expect(check({ name: "n".repeat(65) }).success).toBe(false);
    expect(PublicWake.safeParse({ ...PUBLIC_WAKE, remora: "r".repeat(65) }).success).toBe(false);
    expect(PublicWake.safeParse({ ...PUBLIC_WAKE, tx: "t".repeat(65) }).success).toBe(false);
    const checks = Array.from({ length: 21 }, () => PUBLIC_WAKE.checks[0]);
    expect(PublicWake.safeParse({ ...PUBLIC_WAKE, checks }).success).toBe(false);
  });
});

describe("PublicWakePage", () => {
  const page = (token = "pw_x") =>
    wrap(
      <Routes>
        <Route path="/p/:token" element={<PublicWakePage />} />
      </Routes>,
      `/p/${token}`,
    );

  it("renders signed out from the fixture, with the checks, and sets the page meta", async () => {
    const calls = fakeApi(() => Response.json(PUBLIC_WAKE));
    page("pw_x");

    expect((await screen.findByTestId("verify-verdict")).textContent).toContain("Verified");
    expect(calls[0]?.url).toBe("/api/public/wakes/pw_x");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Pay 0.05 USDC to Sui risk check");
    expect(text).toContain("scout");
    expect(within(screen.getByLabelText("Checks")).getAllByRole("listitem")).toHaveLength(
      PUBLIC_WAKE.checks.length,
    );
    // No owner controls.
    expect(screen.queryByRole("button", { name: /share|stop sharing/i })).toBeNull();
    expect(document.title).toContain("scout");
    expect(
      document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    ).toContain("Pay 0.05 USDC");
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "noindex, nofollow",
    );
  });

  it("renders none of the private fields an API response carries by mistake", async () => {
    fakeApi(() =>
      Response.json({
        ...PUBLIC_WAKE,
        prompt: "SECRET-PROMPT",
        memory: "SECRET-MEMORY text about the owner",
        ownerEmail: "owner@example.com",
        ownerAddress: "0xOWNERADDR",
        action: { ...PUBLIC_WAKE.action, reason: "SECRET-REASON" },
        intent: { memories: [{ blobId: "SECRET-BLOB" }], trigger: { ref: "tg:SECRET" } },
      }),
    );
    page();

    await screen.findByTestId("verify-verdict");
    const text = document.body.innerHTML;
    for (const secret of ["SECRET", "owner@example.com", "0xOWNERADDR"])
      expect(text).not.toContain(secret);
  });

  it.each([404, 410])("says the proof was revoked or doesn't exist on %s", async (status) => {
    fakeApi(() => Response.json({ error: "gone" }, { status }));
    page();
    expect(await screen.findByText("This proof was revoked or doesn't exist")).toBeDefined();
    expect(screen.queryByTestId("verify-verdict")).toBeNull();
  });

  it("offers a retry on a server error, and treats an unknown shape as an error", async () => {
    fakeApi(() => Response.json({ nope: true }));
    page();
    expect(await screen.findByText("Couldn't load this proof")).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.queryByTestId("verify-verdict")).toBeNull();
  });
});
