/**
 * H6 / A8: Settings -> Leave Remora, on a fake API and a fake wallet. No real account is touched.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import remoraScout from "../../../../../packages/schema/fixtures/remora-view.scout.json";
import { ACCOUNT_EXPORT_FIXTURE, ACCOUNT_RETIRE_FIXTURE } from "./account-exit";
import { LeaveRemora } from "./leave-remora";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast, Toaster: () => null }));

const sign = vi.hoisted(() => vi.fn());
vi.mock("@/features/funds/sign", () => ({ useSignAndRun: () => sign }));

const DIGEST = "8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ";
const scout = {
  ...remoraScout,
  id: "1b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a11",
  name: "scout",
  status: "active",
};
const sentinel = {
  ...remoraScout,
  id: "2b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a12",
  name: "sentinel",
  status: "paused",
};
const old = {
  ...remoraScout,
  id: "3b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a13",
  name: "old-one",
  status: "retired",
};

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
const gone = () => Response.json({ error: "nope" }, { status: 404 });
const remorasRoute =
  (rows: unknown[], rest: Handler = gone): Handler =>
  (url, init) =>
    url.endsWith("/api/remoras") ? Response.json({ remoras: rows }) : rest(url, init);

let downloads: Array<{ name: string; blob: Blob }> = [];

beforeEach(() => {
  downloads = [];
  sign.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
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
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((blob: Blob) => `blob:${downloads.push({ name: "", blob })}`),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const last = downloads.at(-1);
    if (last) last.name = this.download;
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const readBlob = (blob?: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    if (blob) r.readAsText(blob);
  });

const today = () => new Date().toISOString().slice(0, 10);

describe("Export everything", () => {
  it("downloads remora-export-<date>.json from the account export", async () => {
    fakeApi(
      remorasRoute([scout], (url) =>
        url.endsWith("/api/account/export") ? Response.json(ACCOUNT_EXPORT_FIXTURE) : gone(),
      ),
    );
    render(<LeaveRemora />);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.name).toBe(`remora-export-${today()}.json`);
    expect(JSON.parse(await readBlob(downloads[0]?.blob))).toEqual(ACCOUNT_EXPORT_FIXTURE);
    expect((await screen.findByTestId("export-note")).textContent).toContain(
      "1 memories and 1 Wakes",
    );
  });

  it("falls back to the memory export when the account export is missing, and says so", async () => {
    const calls = fakeApi(
      remorasRoute([scout], (url) =>
        url.includes("/api/me/export")
          ? Response.json({ coverage: { memories: 2, withText: 2, verified: 2 }, memories: [] })
          : gone(),
      ),
    );
    render(<LeaveRemora />);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0]?.name).toBe(`remora-export-${today()}.json`);
    expect(calls.some((c) => c.url.includes("/api/me/export?format=json"))).toBe(true);
    const note = (await screen.findByTestId("export-note")).textContent ?? "";
    expect(note).toContain("memories only");
    expect(note).toContain("Wakes (receipts) are not included");
  });
});

describe("Retire all remoras", () => {
  const route: Handler = (url) =>
    url.endsWith("/api/account/retire")
      ? Response.json(ACCOUNT_RETIRE_FIXTURE)
      : url.endsWith("/api/account/retire/confirm")
        ? Response.json({
            retired: [
              "1b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a11",
              "2b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a12",
            ],
          })
        : gone();

  const open = async () => {
    fireEvent.click(await screen.findByRole("button", { name: /Retire all/ }));
    return screen.findByRole("alertdialog");
  };

  it("lists exactly the remoras that are not retired", async () => {
    fakeApi(remorasRoute([scout, sentinel, old], route));
    render(<LeaveRemora />);
    const list = await screen.findByRole("list", { name: "Remoras that will be retired" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["scout", "sentinel"]);
  });

  it("needs the typed word, signs the prepared transaction, then shows the digest and verify link", async () => {
    sign.mockResolvedValue(DIGEST);
    const calls = fakeApi(remorasRoute([scout, sentinel], route));
    render(<LeaveRemora />);
    const dialog = await open();

    const confirm = within(dialog).getByRole("button", { name: "Retire all" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText(/Type/), { target: { value: "retire" } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(sign).toHaveBeenCalledWith(ACCOUNT_RETIRE_FIXTURE.transaction));
    const link = await screen.findByRole("link", { name: "Verify it" });
    expect(link.getAttribute("href")).toBe(`/verify/${DIGEST}`);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toContain("POST /api/account/retire/confirm");
    expect(toast.success).toHaveBeenCalled();
  });

  it("cancel changes nothing: no request, no signature", async () => {
    const calls = fakeApi(remorasRoute([scout], route));
    render(<LeaveRemora />);
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(sign).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Verify it" })).toBeNull();
  });

  it("shows a human error when the wallet signature is rejected, and records nothing", async () => {
    sign.mockRejectedValue(new Error("User rejected the request"));
    const calls = fakeApi(remorasRoute([scout], route));
    render(<LeaveRemora />);
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Type/), { target: { value: "RETIRE" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retire all" }));

    expect(
      await within(dialog).findByText(/declined the signature.*Nothing was retired/),
    ).toBeDefined();
    expect(calls.some((c) => c.url.endsWith("/retire/confirm"))).toBe(false);
    expect(screen.queryByRole("link", { name: "Verify it" })).toBeNull();
  });

  it("says 'not available yet' quietly while the endpoint 404s", async () => {
    fakeApi(remorasRoute([scout]));
    render(<LeaveRemora />);
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Type/), { target: { value: "retire" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retire all" }));

    expect(await within(dialog).findByText(/Not available yet/)).toBeDefined();
    expect(sign).not.toHaveBeenCalled();
  });

  it("is disabled, with a reason, when there are no active remoras", async () => {
    fakeApi(remorasRoute([old]));
    render(<LeaveRemora />);
    expect(await screen.findByText(/no active remoras/)).toBeDefined();
    expect((screen.getByRole("button", { name: /Retire all/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("does not promise to delete memories", async () => {
    fakeApi(remorasRoute([scout]));
    render(<LeaveRemora />);
    await screen.findByRole("list", { name: "Remoras that will be retired" });
    const text = document.body.textContent ?? "";
    expect(text).toContain("stay on Walrus until they expire");
    expect(text).not.toMatch(/delete (my|your) data/i);
  });
});
