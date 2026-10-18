/**
 * Render smoke tests.
 *
 * These pages had never been opened in a browser: typecheck and a successful
 * build say nothing about whether a component throws on first paint, which is
 * exactly what a judge clicking the live URL would hit. Each test mounts a page
 * with the network stubbed and asserts something a user would actually see.
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSyncExternalStore } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logo } from "../components/logo.tsx";
import { writeActiveChat } from "../features/chat/active-chat.ts";
import { ChatPage } from "../features/chat/chat-page.tsx";
import { greetingsFor, greetingText } from "../features/chat/greeting.ts";
import { ConnectPage } from "../features/connect/connect-page.tsx";
import { GuidePage } from "../features/guide/guide-page.tsx";
import { MePage } from "../features/me/me-page.tsx";
import { TeamPage } from "../features/team/team-page.tsx";
import { AppLayout } from "./app-layout.tsx";
import { NotFoundPage } from "./not-found.tsx";

/**
 * The chat transport is real network; what we care about is what each state
 * paints. `chatMessages` lets a test put the page into "there is a conversation"
 * without a server.
 */
let chatMessages: unknown[] = [];
let chatStatus = "ready";
let chatVersion = 0;
const chatSubscribers = new Set<() => void>();
const chatSend = vi.fn();
const chatStop = vi.fn();
const chatRegenerate = vi.fn();

function publishChat() {
  chatVersion += 1;
  for (const subscriber of chatSubscribers) subscriber();
}

function setChatStatus(status: string) {
  chatStatus = status;
  publishChat();
}

vi.mock("@ai-sdk/react", () => ({
  useChat: () => {
    // New chat calls setMessages. The page has to re-render from that, the
    // same way the real hook does, or the empty state never comes back.
    useSyncExternalStore(
      (cb) => {
        chatSubscribers.add(cb);
        return () => chatSubscribers.delete(cb);
      },
      () => chatVersion,
      () => chatVersion,
    );
    return {
      messages: chatMessages,
      sendMessage: chatSend,
      stop: chatStop,
      regenerate: chatRegenerate,
      setMessages: (next: unknown[] | ((prev: unknown[]) => unknown[])) => {
        chatMessages = typeof next === "function" ? next(chatMessages) : next;
        publishChat();
      },
      status: chatStatus,
      error: undefined,
    };
  },
}));

/**
 * What matters is that a failure is reported once and not left on the page.
 * Rendering sonner's own internals under jsdom tests sonner, not hippo.
 */
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m) },
  Toaster: () => null,
}));

/**
 * dapp-kit reaches for wallet APIs that jsdom has no notion of.
 *
 * `wallet` stands in for a connected one. Registering a real wallet-standard
 * wallet would additionally exercise dapp-kit's discovery, which is not our
 * code; what has never run is the connect page's own orchestration, and that is
 * what these stand-ins let us drive.
 */
let wallet: { address: string } | null = null;
let installedWallets: Array<{ name: string; id?: string; features?: Record<string, unknown> }> = [];
const signAndExecute = vi.fn(async () => ({ digest: "0xdigest" }));
const connectWallet = vi.fn(async () => ({ accounts: [] as Array<{ address: string }> }));
const suiClientStub: { core: Record<string, unknown>; getBalance?: unknown } = { core: {} };

vi.mock("@mysten/dapp-kit", () => ({
  ConnectModal: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
  useCurrentAccount: () => wallet,
  useCurrentWallet: () => ({ currentWallet: null, isConnected: Boolean(wallet) }),
  useWallets: () => installedWallets,
  useConnectWallet: () => ({ mutateAsync: connectWallet }),
  useSignAndExecuteTransaction: () => ({ mutateAsync: signAndExecute }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn(async () => ({ signature: "sig" })) }),
  useSignTransaction: () => ({ mutateAsync: vi.fn(async () => ({ signature: "sig" })) }),
  useSuiClient: () => suiClientStub,
}));

/**
 * Routes are matched on the path, not as a substring of the whole URL.
 *
 * Substring matching looks harmless and is a trap: "/api/me/search?q=x"
 * contains "/api/me", so a test that forgot to stub the search route got the
 * profile object back with `ok: true` and passed while exercising nothing. A
 * key matches only if it is the whole path, or a prefix ending in "/".
 */
function stubFetch(routes: Record<string, unknown>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  return vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).split("?")[0] ?? "";
    const match = keys.find((k) => path === k || (k.endsWith("/") && path.startsWith(k)));
    return {
      ok: match !== undefined,
      status: match === undefined ? 404 : 200,
      json: async () => (match === undefined ? {} : routes[match]),
    } as Response;
  });
}

beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  chatMessages = [];
  chatStatus = "ready";
  chatVersion = 0;
  chatSend.mockClear();
  chatStop.mockClear();
  chatRegenerate.mockClear();
  wallet = null;
  installedWallets = [];
  signAndExecute.mockClear();
  connectWallet.mockReset();
  connectWallet.mockImplementation(async () => ({ accounts: [] }));
  suiClientStub.core = {};
  suiClientStub.getBalance = undefined;
  // jsdom here has neither storage; the examples must survive without one.
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => session.get(k) ?? null,
    setItem: (k: string, v: string) => void session.set(k, v),
    removeItem: (k: string) => void session.delete(k),
  });
  toastError.mockClear();
  vi.stubGlobal("fetch", stubFetch({}));
  vi.stubGlobal("innerWidth", 1440);
  // jsdom has neither of these, and both the toaster and the theme toggle read
  // them on mount. Without them the component throws before it paints.
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // The landing headline animates on view. Never firing is the right default
  // here: it leaves the text in its scrambled state, which is exactly the case
  // where the assertions below must still find the real words.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function showsAGreeting(seen: string): boolean {
  return greetingsFor(new Date()).some((line) => seen.includes(greetingText(line)));
}

const HIDDEN_GUIDANCE = [
  /memory you own/i,
  /Take ownership/i,
  /Take it away/i,
  /public storage network/i,
  /anyone can download/i,
  /seven months/i,
  /\/memory off/,
  /cannot delete the bytes early/i,
  /Try one/,
  /Now prove it/,
  /Talk to it/,
];

describe("chat page", () => {
  it("opens on a greeting instead of the instruction block", () => {
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const seen = container.textContent ?? "";
    expect(showsAGreeting(seen)).toBe(true);
    for (const phrase of HIDDEN_GUIDANCE) expect(seen).not.toMatch(phrase);
    expect(screen.getByRole("button", { name: /send/i })).toBeDefined();
    const add = screen.getByRole("button", { name: "Add" });
    expect((add as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector("[data-slot='composer-shell']")?.textContent).toContain(
      "Gemini 2.5 Flash",
    );
    expect(screen.queryByText(/Try one/)).toBeNull();
    expect(screen.getByRole("link", { name: /Open in Telegram/ }).getAttribute("href")).toBe(
      "https://t.me/walrussession8_bot",
    );
  });

  it("offers something to teach it before there is a conversation", async () => {
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    // One message proves nothing here, so the first set is things to teach it.
    const chip = screen.getByRole("button", { name: /only use pnpm/i });
    expect(screen.queryByRole("button", { name: /Reload, then ask/i })).toBeNull();

    await userEvent.click(chip);
    expect(chatSend).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveProperty(
      "value",
      "I only use pnpm, and I want short answers in Vietnamese.",
    );
  });

  it("switches to proving it once hippo has answered", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "I use pnpm" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Noted." }], metadata: {} },
    ];
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Reload, then ask/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /only use pnpm/i })).toBeNull();
    expect(container.textContent ?? "").not.toMatch(/came back from Walrus, not from the page/i);
  });

  it("shows a command's answer as a table without treating it as something taught", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "/whoami" }] },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "Mode: owned." }],
        metadata: {
          command: true,
          table: {
            lead: "Mode: owned.",
            columns: ["Field", "Value"],
            rows: [
              { cells: ["Namespace", "hippo"], copy: "hippo" },
              {
                cells: ["Account", "0xabc"],
                copy: "0xfull",
                href: "https://suiscan.xyz/mainnet/object/0xfull",
              },
            ],
          },
        },
      },
    ];
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("hippo")).toBeDefined();
    const copyNamespace = screen.getByRole("button", { name: "Copy Namespace" });
    const openAccount = screen.getByRole("link", { name: "Open Account" });
    expect(copyNamespace.getAttribute("data-variant")).toBe("ghost");
    expect(copyNamespace.getAttribute("data-size")).toBe("icon-sm");
    expect(copyNamespace.className).toContain("group-hover/message:opacity-100");
    expect(openAccount.getAttribute("data-variant")).toBe("ghost");
    expect(openAccount.getAttribute("data-size")).toBe("icon-sm");
    expect(openAccount.getAttribute("href")).toBe("https://suiscan.xyz/mainnet/object/0xfull");
    expect(container.querySelector("pre")).toBeNull();
    expect(screen.queryByRole("button", { name: /Reload, then ask/i })).toBeNull();
  });

  it("leaves a rate-limit sentence as a sentence", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "/whoami" }] },
      {
        id: "2",
        role: "assistant",
        parts: [{ type: "text", text: "Give me a minute and ask again." }],
        metadata: { command: true },
      },
    ];
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Give me a minute and ask again.")).toBeDefined();
    expect(container.querySelector("table")).toBeNull();
    expect(container.querySelector("pre")).toBeNull();
  });

  it("bubbles what you said and leaves hippo's answer in the page", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "I use pnpm" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Noted." }], metadata: {} },
    ];
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    // Both sides used to be bubbles, which cramped every long answer and made
    // the two voices compete. Only the user's turn carries one now.
    const bubbles = container.querySelectorAll("[data-slot='bubble']");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.textContent).toBe("I use pnpm");
    expect(container.textContent ?? "").toMatch(/Noted\./);
  });

  it("shows hippo thinking before the first word arrives", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "2", role: "assistant", parts: [], metadata: {} },
    ];
    chatStatus = "submitted";
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status", { name: /thinking/i })).toBeDefined();
  });

  it("shows a loading line while the reply has not started", () => {
    chatMessages = [{ id: "1", role: "user", parts: [{ type: "text", text: "hello" }] }];
    chatStatus = "submitted";
    render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status", { name: /reading memories/i })).toBeDefined();
  });

  it("drops the landing section once there is a conversation", () => {
    // Keyed off messages.length. Leaving it above a real conversation would
    // push every reply below the fold, which is worse than not having it.
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "I use pnpm" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Noted." }], metadata: {} },
    ];
    const { container } = render(
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>,
    );
    const seen = container.textContent ?? "";
    expect(seen).toMatch(/Noted\./);
    expect(container.querySelector("[data-slot='greeting']")).toBeNull();
    expect(seen).not.toMatch(/memory you own/i);
  });

  function mountChat() {
    return render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("fills the page with a rail, a composer, and no instruction block", () => {
    const { container } = mountChat();
    const shell = container.querySelector("[data-slot='sidebar']") as HTMLElement;
    const rail = container.querySelector("[data-sidebar='sidebar']") as HTMLElement;
    if (!shell || !rail) throw new Error("sidebar missing");
    expect(shell.getAttribute("data-variant")).toBe("inset");
    const railText = rail.textContent ?? "";
    expect(railText.indexOf("New chat")).toBeGreaterThanOrEqual(0);
    expect(railText.indexOf("New chat")).toBeLessThan(railText.indexOf("My memory"));
    const group = rail.querySelector("[data-sidebar='group']");
    expect(group?.className).toContain("p-2");
    expect(group?.textContent).toContain("New chat");
    expect(group?.textContent).toContain("My memory");
    expect(
      within(rail)
        .getByRole("link", { name: /my memory/i })
        .getAttribute("href"),
    ).toBe("/me");
    const sidebarToggle = container.querySelector(
      "header [data-sidebar='trigger']",
    ) as HTMLButtonElement;
    expect(sidebarToggle.getAttribute("data-slot")).toBe("sidebar-trigger");
    expect(sidebarToggle.className).not.toContain("size-9");
    expect(sidebarToggle.querySelector("svg")).toBeTruthy();
    const cluster = container.querySelector("[data-slot='empty-cluster']");
    expect(cluster).toBeTruthy();
    expect(cluster?.parentElement?.className).toMatch(/items-center/);
    expect(cluster?.parentElement?.className).toMatch(/justify-center/);
    expect(cluster?.parentElement?.className).not.toMatch(/pt-16/);
    const greeting = cluster?.querySelector("[data-slot='greeting']");
    if (!greeting) throw new Error("greeting missing");
    const box = within(cluster as HTMLElement).getByRole("textbox");
    const suggestion = within(cluster as HTMLElement).getByRole("button", {
      name: /only use pnpm/i,
    });
    expect(showsAGreeting(greeting.textContent ?? "")).toBe(true);
    expect(greeting.querySelector(".font-greeting")).toBeTruthy();
    expect(greeting.textContent ?? "").not.toContain("hippo");
    expect(greeting.querySelector("img")).toBeNull();
    expect(greeting.className).toContain("text-center");
    expect(greeting.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(suggestion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(suggestion.getAttribute("data-slot")).not.toBe("button");
    expect(suggestion.className).toContain("text-sm");
    expect(suggestion.className).toContain("hover:text-primary");
    expect(screen.getByRole("button", { name: /send/i })).toBeDefined();
    expect(screen.queryByText(/^Try one$/)).toBeNull();
    const seen = container.textContent ?? "";
    for (const phrase of HIDDEN_GUIDANCE) expect(seen).not.toMatch(phrase);
    const theme = screen.getByRole("button", { name: /switch to (dark|light)/i });
    expect(theme.className).toContain("size-9");
  });

  it("sends from the button and from Enter, and Shift+Enter does not", async () => {
    const user = userEvent.setup();
    mountChat();
    const box = screen.getByRole("textbox");

    await user.type(box, "hello from the button");
    await user.click(screen.getByRole("button", { name: /send/i }));
    expect(chatSend).toHaveBeenCalledWith({ text: "hello from the button" });

    chatSend.mockClear();
    await user.clear(box);
    await user.type(box, "hello from enter{Enter}");
    expect(chatSend).toHaveBeenCalledWith({ text: "hello from enter" });

    chatSend.mockClear();
    await user.type(box, "keep this{Shift>}{Enter}{/Shift}");
    expect(chatSend).not.toHaveBeenCalled();
  });

  it("runs a slash command from the menu without pressing send", async () => {
    const user = userEvent.setup();
    mountChat();
    const box = screen.getByRole("textbox");
    await user.type(box, "/");
    const memory = await screen.findByRole("option", {
      name: /\/memory what I remember about you/i,
    });
    expect(screen.getByRole("option", { name: /\/whoami your account/i })).toBeDefined();
    expect(document.querySelector("[data-slot='command-list']")?.className).toContain(
      "scroll-fade-y",
    );
    await user.click(memory);
    expect(chatSend).not.toHaveBeenCalled();
    const filled = screen.getByRole("textbox");
    expect(filled).toHaveProperty("value", "/memory");
    const shell = filled.closest("[data-slot='composer-shell']");
    const token = shell?.querySelector("[data-command-token]");
    expect(token?.textContent).toBe("/memory");
    expect(token?.className).toContain("text-[#156BC1]");
    expect(screen.getByRole("option", { name: /\/memory search/i })).toBeDefined();
    expect(screen.getByRole("option", { name: /\/memory forget <blob>/i })).toBeDefined();
    await user.type(filled, " search");
    const rest = shell?.querySelector("[data-command-rest]");
    expect(rest?.textContent).toBe(" search");
    expect(rest?.className).not.toContain("text-[#156BC1]");
  });

  it("retries the last answer and edits the last user line through one resend", async () => {
    const user = userEvent.setup();
    chatMessages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Hi.\n\n```ts\nconst n = 1\n```" }],
        metadata: {},
      },
    ];
    mountChat();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const edit = screen.getAllByRole("button", { name: "Edit message" });
    const retry = screen.getAllByRole("button", { name: "Retry answer" });
    const copies = screen.getAllByRole("button", { name: "Copy message" });
    expect(edit).toHaveLength(1);
    expect(retry).toHaveLength(1);
    expect(copies).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Copy value" })).toBeNull();
    expect(retry[0]?.previousElementSibling).toBe(copies[1]);
    for (const control of [edit[0], retry[0], copies[0], copies[1]]) {
      expect(control?.getAttribute("data-variant")).toBe("ghost");
      expect(control?.getAttribute("data-size")).toBe("icon-sm");
      expect(control?.className).toContain("opacity-0");
      expect(control?.className).toContain("group-hover/message:opacity-100");
    }
    const actions = copies[1]?.closest("[data-slot='message-actions']");
    const content = copies[1]?.closest("[data-slot='message-content']");
    expect(actions?.className).not.toMatch(/gap-/);
    expect(content?.className).toContain("gap-1");
    const code = screen.getByRole("button", { name: "Copy ts code" });
    expect(code.getAttribute("data-variant")).toBe("ghost");
    expect(code.getAttribute("data-size")).toBe("icon-sm");
    expect(code.className).toContain("group-hover/message:opacity-100");

    await user.click(copies[1] as HTMLElement);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("Hi.\n\n```ts\nconst n = 1\n```");
    });

    await user.click(screen.getByRole("button", { name: "Retry answer" }));
    expect(chatRegenerate).toHaveBeenCalledWith({ messageId: "u1" });
    expect(chatMessages.map((message) => (message as { role: string }).role)).toEqual(["user"]);
    expect(chatSend).not.toHaveBeenCalled();

    chatRegenerate.mockClear();
    chatMessages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hi." }], metadata: {} },
    ];
    publishChat();
    await user.click(screen.getByRole("button", { name: "Edit message" }));
    const editor = screen.getByRole("textbox", { name: "Edit message" });
    await user.clear(editor);
    await user.type(editor, "hello again");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(chatRegenerate).toHaveBeenCalledWith({ messageId: "u1" });
    const kept = chatMessages[0] as { parts: Array<{ text: string }> };
    expect(kept.parts[0]?.text).toBe("hello again");
    expect(chatMessages.some((message) => (message as { role: string }).role === "assistant")).toBe(
      false,
    );
  });

  it("hides retry and edit while a reply is streaming and on a slash command", () => {
    chatStatus = "streaming";
    chatMessages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hi." }], metadata: {} },
    ];
    const view = mountChat();
    expect(screen.queryByRole("button", { name: "Retry answer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit message" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy message" })).toBeNull();
    view.unmount();

    chatStatus = "ready";
    chatMessages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "/memory" }] },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Mode: guest." }],
        metadata: { command: true },
      },
    ];
    mountChat();
    expect(screen.queryByRole("button", { name: "Retry answer" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Copy message" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Edit message" })).toBeDefined();
  });

  it("filters the chat list in the sidebar", async () => {
    const user = userEvent.setup();
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/conversations": {
          conversations: [
            { id: first, title: "Postgres on 5433", updatedAt: "2026-09-26T00:00:00.000Z" },
            { id: second, title: "Vietnamese answers", updatedAt: "2026-09-26T00:00:00.000Z" },
          ],
        },
      }),
    );
    mountChat();
    expect(await screen.findByRole("button", { name: "Postgres on 5433" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Vietnamese answers" })).toBeDefined();
    const search = screen.getByRole("textbox", { name: "Search chats" });
    expect(search.closest("[data-slot='input-group']")?.querySelector("svg")).toBeTruthy();
    expect(search.closest("[data-slot='scroll-area']")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Postgres on 5433" }).closest("[data-slot='scroll-area']"),
    ).toBeTruthy();
    expect(document.querySelector("[data-slot='sidebar-content']")?.className).toContain(
      "overflow-hidden",
    );
    const viewport = document.querySelector("[data-slot='scroll-area-viewport']");
    expect(viewport?.className).toContain("scroll-fade-y");
    expect(viewport?.className).toContain("min-w-0");
    expect(
      screen.getByRole("button", { name: "Postgres on 5433" }).closest("[data-slot='sidebar-menu']")
        ?.className,
    ).toContain("pe-3");
    await user.type(search, "postgres");
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Vietnamese answers" })).toBeNull();
    });
    expect(screen.getByRole("button", { name: "Postgres on 5433" })).toBeDefined();
    await user.clear(search);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Vietnamese answers" })).toBeDefined();
    });
    await user.type(search, "zzzz");
    await waitFor(() => {
      expect(screen.getByText("No chats")).toBeDefined();
    });
  });

  it("shows the memory a reopened answer used, and leaves a hidden one out", async () => {
    const user = userEvent.setup();
    const id = "11111111-1111-4111-8111-111111111111";
    writeActiveChat(id);
    vi.stubGlobal(
      "fetch",
      stubFetch({
        [`/api/conversations/${id}/messages`]: {
          messages: [
            { id: "u1", role: "user", kind: "turn", text: "what do you know?", seq: 1 },
            {
              id: "a1",
              role: "assistant",
              kind: "turn",
              text: "You use pnpm.",
              seq: 2,
              cites: [
                { blobId: "blob-keep", type: "profile", distance: 0.2 },
                { blobId: "blob-hidden", type: "profile", distance: 0.4 },
              ],
            },
          ],
        },
        [`/api/conversations/${id}/citations`]: {
          status: "complete",
          limited: false,
          messages: [
            {
              id: "a1",
              recalled: [
                { type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" },
              ],
            },
          ],
        },
        [`/api/conversations/${id}/memories`]: { limited: false, memories: [] },
      }),
    );
    mountChat();
    const recalled = await screen.findByRole("button", { name: /recalled 1 memory/i });
    expect(screen.queryByText("I use pnpm")).toBeNull();
    await user.click(recalled);
    expect(screen.getByText(/I use pnpm/)).toBeDefined();
    expect(screen.queryByText("blob-hidden")).toBeNull();
  });

  it("answers again without memory beside an answer that used memory", async () => {
    const user = userEvent.setup();
    const id = "22222222-2222-4222-8222-222222222222";
    writeActiveChat(id);
    const fetchMock = stubFetch({
      [`/api/conversations/${id}/messages`]: {
        messages: [
          { id: "u1", role: "user", kind: "turn", text: "which package manager?", seq: 1 },
          {
            id: "a1",
            role: "assistant",
            kind: "turn",
            text: "bun, as you switched last month.",
            seq: 2,
            cites: [{ blobId: "blob-bun", type: "correction", distance: 0.2 }],
          },
        ],
      },
      [`/api/conversations/${id}/citations`]: {
        status: "complete",
        limited: false,
        messages: [
          {
            id: "a1",
            recalled: [
              { type: "correction", text: "We moved to bun", relevance: 0.8, blobId: "blob-bun" },
            ],
          },
        ],
      },
      [`/api/conversations/${id}/memories`]: { limited: false, memories: [] },
      "/api/chat/compare": { text: "It depends on your project; npm is the default." },
    });
    vi.stubGlobal("fetch", fetchMock);
    mountChat();
    await user.click(await screen.findByRole("button", { name: "Answer without memory" }));
    expect(await screen.findByText("Without Walrus memory")).toBeDefined();
    expect(screen.getByText("It depends on your project; npm is the default.")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/chat/compare",
      expect.objectContaining({ body: JSON.stringify({ conversationId: id, messageId: "u1" }) }),
    );
  });

  it("shows the facts it could read and says when the rest did not come back", async () => {
    const user = userEvent.setup();
    const id = "11111111-1111-4111-8111-111111111111";
    writeActiveChat(id);
    vi.stubGlobal(
      "fetch",
      stubFetch({
        [`/api/conversations/${id}/messages`]: {
          messages: [
            { id: "u1", role: "user", kind: "turn", text: "what do you know?", seq: 1 },
            {
              id: "a1",
              role: "assistant",
              kind: "turn",
              text: "You use pnpm.",
              seq: 2,
              cites: [{ blobId: "blob-keep", type: "profile", distance: 0.2 }],
            },
          ],
        },
        [`/api/conversations/${id}/citations`]: {
          status: "partial",
          limited: true,
          message: "Could not read every source back from Walrus just now. Try again.",
          messages: [
            {
              id: "a1",
              recalled: [
                { type: "profile", text: "I use pnpm", relevance: 0.8, blobId: "blob-keep" },
              ],
            },
          ],
        },
        [`/api/conversations/${id}/memories`]: { limited: false, memories: [] },
      }),
    );
    mountChat();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.getByText(/could not read every source/i)).toBeDefined();
    await user.click(screen.getByRole("button", { name: /recalled 1 memory/i }));
    expect(screen.getByText(/I use pnpm/)).toBeDefined();
  });

  it("does not invent a memory when Walrus cannot be reached, and keeps the answer", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    writeActiveChat(id);
    vi.stubGlobal(
      "fetch",
      stubFetch({
        [`/api/conversations/${id}/messages`]: {
          messages: [
            { id: "u1", role: "user", kind: "turn", text: "what do you know?", seq: 1 },
            {
              id: "a1",
              role: "assistant",
              kind: "turn",
              text: "You use pnpm.",
              seq: 2,
              cites: [{ blobId: "blob-keep", type: "profile", distance: 0.2 }],
            },
          ],
        },
        [`/api/conversations/${id}/citations`]: {
          status: "unavailable",
          limited: true,
          message: "Walrus Memory could not be reached just now. Try again.",
          messages: [{ id: "a1", recalled: [] }],
        },
        [`/api/conversations/${id}/memories`]: { limited: false, memories: [] },
      }),
    );
    mountChat();
    expect(await screen.findByText("You use pnpm.")).toBeDefined();
    expect(await screen.findByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /recalled/i })).toBeNull();
    expect(screen.queryByText("I use pnpm")).toBeNull();
  });

  it("does not correct a fact whose wording did not come back, and hides one that did", async () => {
    const user = userEvent.setup();
    const id = "11111111-1111-4111-8111-111111111111";
    const indexId = "33333333-3333-4333-8333-333333333333";
    writeActiveChat(id);
    vi.stubGlobal(
      "fetch",
      stubFetch({
        [`/api/conversations/${id}/messages`]: {
          messages: [{ id: "u1", role: "user", kind: "turn", text: "hello", seq: 1 }],
        },
        [`/api/conversations/${id}/memories`]: {
          limited: false,
          memories: [
            {
              id: indexId,
              type: "profile",
              text: "I use pnpm",
              status: "stored",
              blobId: "blob-1",
            },
            {
              id: "44444444-4444-4444-8444-444444444444",
              type: "gotcha",
              status: "stored",
              blobId: "blob-2",
            },
          ],
        },
        "/api/me/memories/visibility": { hidden: true },
      }),
    );
    mountChat();
    expect(await screen.findByRole("button", { name: "Correct" })).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Correct" })).toHaveLength(1);
    await user.click(screen.getAllByRole("button", { name: "Hide" })[0]);
    expect(await screen.findByText(/still on Walrus/i)).toBeDefined();
  });

  it("shows no error on a new chat's first turn, then lists what it remembered", async () => {
    const user = userEvent.setup();
    const others = stubFetch({ "/api/me": { mode: "guest", memoryEnabled: true } });
    let saved = false;
    let memoryReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input).split("?")[0] ?? "";
        if (!/^\/api\/conversations\/[^/]+\/memories$/.test(path)) return others(input);
        memoryReads += 1;
        if (!saved) return { ok: false, status: 404, json: async () => ({}) } as Response;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            limited: false,
            memories: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                type: "gotcha",
                text: "Postgres runs on 5433",
                status: "stored",
                blobId: "blob-1",
              },
            ],
          }),
        } as Response;
      }),
    );
    mountChat();
    await user.type(screen.getByPlaceholderText("Message hippo…"), "Postgres runs on 5433{Enter}");
    expect(chatSend).toHaveBeenCalled();
    await waitFor(() => expect(memoryReads).toBe(1));
    await act(async () => {
      setChatStatus("streaming");
    });
    expect(screen.queryByText("Could not load what this chat remembered.")).toBeNull();
    saved = true;
    await act(async () => {
      setChatStatus("ready");
    });
    expect(await screen.findByText("Postgres runs on 5433")).toBeDefined();
    expect(screen.queryByText("Could not load what this chat remembered.")).toBeNull();
  });

  it("turns memory off from the composer and does not send the chat", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      "/api/me": { mode: "guest", memoryEnabled: true },
      "/api/me/memory": { memoryEnabled: false },
      "/api/me/memories": { memories: [] },
    });
    vi.stubGlobal("fetch", fetchMock);
    mountChat();
    const toggle = await screen.findByRole("switch", { name: "Memory on" });
    await user.click(toggle);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me/memory",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ enabled: false }) }),
      ),
    );
    expect(chatSend).not.toHaveBeenCalled();
  });

  it("fills the composer with a follow-up and does not send it", async () => {
    const user = userEvent.setup();
    const id = "11111111-1111-4111-8111-111111111111";
    writeActiveChat(id);
    chatStatus = "streaming";
    chatMessages = [
      { id: "u1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Hi." }], metadata: {} },
    ];
    vi.stubGlobal(
      "fetch",
      stubFetch({
        [`/api/conversations/${id}/messages`]: {
          messages: [
            { id: "u1", role: "user", kind: "turn", text: "hello", seq: 1 },
            { id: "a1", role: "assistant", kind: "turn", text: "Hi.", seq: 2 },
          ],
        },
        "/api/chat/suggestions": { suggestions: ["What port?", "Which ORM?"] },
      }),
    );
    mountChat();
    await act(async () => {
      setChatStatus("ready");
    });
    const suggestion = await screen.findByRole("button", { name: "What port?" });
    await user.click(suggestion);
    const box = screen.getByPlaceholderText("Message hippo…");
    expect(box).toHaveProperty("value", "What port?");
    expect(chatSend).not.toHaveBeenCalled();
  });

  it("keeps the memory panel closed after the person closes it", async () => {
    const user = userEvent.setup();
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
      removeItem: (key: string) => void stored.delete(key),
    });
    const view = mountChat();
    expect(screen.getByText("Nothing remembered in this chat yet.")).toBeDefined();
    expect(screen.queryByRole("tab", { name: "Memory" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Close memory" }));
    expect(screen.queryByRole("button", { name: "Close memory" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open memory" })).toBeDefined();
    expect(
      view.container.querySelector("[data-slot='memory-panel']")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(stored.get("hippo.memory-panel")).toBe("closed");
    view.unmount();
    mountChat();
    expect(screen.queryByRole("button", { name: "Close memory" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open memory" })).toBeDefined();
  });

  it("does not cover the chat with the memory sheet on a phone until the person opens it", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("innerWidth", 500);
    mountChat();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open memory" })).toBeDefined());
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open memory" }));
    expect(await screen.findByRole("dialog")).toBeDefined();
    expect(screen.getByText("Nothing remembered in this chat yet.")).toBeDefined();
  });

  it("keeps the memory panel off the chat on a tablet until the person opens it", async () => {
    vi.stubGlobal("innerWidth", 1024);
    mountChat();
    await waitFor(() => expect(screen.getByRole("button", { name: "Open memory" })).toBeDefined());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("[data-slot='memory-panel']")).toBeNull();
  });

  it("says a Google sign-in gets an address only hippo uses", async () => {
    const user = userEvent.setup();
    installedWallets = [
      { name: "Slush" },
      {
        name: "Sign in with Google",
        features: { "enoki:getMetadata": { getMetadata: () => ({ provider: "google" }) } },
      },
    ];
    vi.stubGlobal("fetch", stubFetch({ "/api/me": { mode: "guest", memoryEnabled: true } }));
    mountChat();
    await user.click(await screen.findByRole("button", { name: "Connect wallet" }));
    expect(await screen.findByRole("button", { name: "Sign in with Google" })).toBeDefined();
    expect(screen.getByText(/only hippo uses/)).toBeDefined();
    expect(screen.getByText(/or your Google account/)).toBeDefined();
  });

  it("asks a guest to own their memory before keeping a private file", async () => {
    const user = userEvent.setup();
    vi.stubEnv("VITE_SEAL_API_KEY", "test-key");
    vi.stubGlobal("fetch", stubFetch({ "/api/me": { mode: "guest", memoryEnabled: true } }));
    mountChat();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("dialog", { name: "Private files" })).toBeDefined();
    expect(await screen.findByText(/Private files need a memory you own/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Upload a \.txt/ })).toBeNull();
  });

  it("offers an upload to the owner once their own wallet is connected", async () => {
    const user = userEvent.setup();
    const owner = `0x${"ab".repeat(32)}`;
    vi.stubEnv("VITE_SEAL_API_KEY", "test-key");
    wallet = { address: owner };
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": {
          mode: "owned",
          memoryEnabled: true,
          walletAddress: owner,
          accountId: `0x${"cd".repeat(32)}`,
        },
        "/api/documents": { documents: [] },
      }),
    );
    mountChat();
    await waitFor(() => expect(screen.getByRole("switch", { name: "Memory on" })).toBeDefined());
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(
      await screen.findByRole("button", { name: /Upload a \.txt or \.md file/ }),
    ).toBeDefined();
    expect(screen.queryByText(/Private files need a memory you own/)).toBeNull();
  });

  it("closes the sidebar on a phone once the person starts a new chat", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("innerWidth", 500);
    mountChat();
    await user.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    const sheet = await screen.findByRole("dialog", { name: "Sidebar" });
    await user.click(within(sheet).getByRole("button", { name: "New chat" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sidebar" })).toBeNull());
  });

  it("shows a remembered fact become stored without calling the relayer", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    chatMessages = [
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Noted." },
          {
            type: "tool-remember",
            state: "output-available",
            input: { type: "profile", text: "I use pnpm" },
            output: { saved: true, indexId: id },
          },
        ],
      },
    ];
    const fetchMock = stubFetch({
      [`/api/me/memories/${id}/status`]: {
        status: "stored",
        blobId: "blob-keep",
        hidden: false,
        type: "profile",
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    mountChat();
    expect(await screen.findByText("on Walrus")).toBeDefined();
    expect(screen.getByText("Just remembered")).toBeDefined();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("relayer"))).toBe(false);
    expect(urls.some((url) => url.includes("/status"))).toBe(true);
  });

  it("stops the reply instead of sending another line", async () => {
    chatStatus = "streaming";
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Hel" }], metadata: {} },
    ];
    mountChat();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(chatStop).toHaveBeenCalledOnce();
    expect(chatSend).not.toHaveBeenCalled();
  });

  it("keeps the assistant off the user bubble and shows thinking before words", () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "I use pnpm" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Noted." }], metadata: {} },
    ];
    const { container } = mountChat();
    const bubbles = container.querySelectorAll("[data-slot='bubble']");
    expect(bubbles).toHaveLength(1);
    expect(bubbles[0]?.textContent).toBe("I use pnpm");
    const noted = screen.getByText("Noted.");
    expect(noted.closest("[data-slot='bubble']")).toBeNull();
    expect(screen.getByRole("button", { name: /scroll to end/i })).toBeDefined();
    expect(container.querySelector("[data-slot='greeting']")).toBeNull();
    expect(screen.queryByRole("button", { name: /Reload, then ask/i })).toBeNull();
    expect(container.querySelector("[data-slot='message-scroller-viewport']")?.className).toContain(
      "scroll-fade-y",
    );
    expect(container.querySelector("[data-slot='memory-panel'] .scroll-fade-y")).toBeNull();
    expect(container.querySelector("[data-slot='composer-shell'] .max-h-60")).toBeTruthy();
  });

  it("lists a saved chat and opens it", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/conversations": {
          conversations: [{ id, title: "Postgres on 5433", updatedAt: "2026-09-26T00:00:00.000Z" }],
        },
        [`/api/conversations/${id}/messages`]: {
          messages: [
            { id: "m1", role: "assistant", kind: "turn", text: "Noted from history.", seq: 1 },
          ],
        },
      }),
    );
    const { container } = mountChat();
    const saved = await screen.findByRole("button", { name: "Postgres on 5433" });
    await userEvent.click(saved);
    expect(await screen.findByText("Noted from history.")).toBeDefined();
    expect(container.textContent ?? "").toContain("Noted from history.");
  });

  it("returns to the empty thread when new chat is clicked", async () => {
    chatMessages = [
      { id: "1", role: "user", parts: [{ type: "text", text: "I use pnpm" }] },
      { id: "2", role: "assistant", parts: [{ type: "text", text: "Noted." }], metadata: {} },
    ];
    const { container } = mountChat();
    expect(container.textContent ?? "").toMatch(/Noted\./);
    await userEvent.click(screen.getByRole("button", { name: /new chat/i }));
    const seen = container.textContent ?? "";
    expect(showsAGreeting(seen)).toBe(true);
    expect(seen).not.toMatch(/Noted\./);
    expect(seen).not.toMatch(/I use pnpm/);
  });
});

describe("logo", () => {
  it("pairs the public mark with the word in the lockup, and leaves the word off the mark", () => {
    const lockup = render(<Logo variant="lockup" />);
    const lockupImg = lockup.container.querySelector("img");
    expect(lockupImg?.getAttribute("src") ?? "").toMatch(/\/logo-(black|white)\.svg$/);
    expect(lockup.container.textContent ?? "").toContain("hippo");
    const word = lockup.getByText("hippo");
    const markHeight = Number.parseFloat(lockupImg?.style.height ?? "0");
    const wordSize = Number.parseFloat((word as HTMLElement).style.fontSize);
    expect(markHeight).toBeGreaterThan(wordSize);
    expect(word.parentElement?.style.gap === "0px" || word.parentElement?.style.gap === "0").toBe(
      true,
    );

    const mark = render(<Logo variant="mark" />);
    const markImg = mark.container.querySelector("img");
    expect(markImg?.getAttribute("src") ?? "").toMatch(/\/logo-(black|white)\.svg$/);
    expect(mark.container.textContent ?? "").not.toContain("hippo");
  });
});

describe("how it works", () => {
  it("shows a memory's life, the ownership path and the commands, and lists no memories", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", surveyUrl: null },
        "/api/me/memories": { memories: [] },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <GuidePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Sealed on Walrus/));
    expect(container.textContent ?? "").toMatch(/seven months/);
    expect(container.textContent ?? "").toMatch(/\/connect/);
    expect(container.textContent ?? "").toMatch(/\/compare/);
    expect(screen.getByRole("link", { name: /Start chatting/ }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: /Open in Telegram/ }).getAttribute("href")).toBe(
      "https://t.me/walrussession8_bot",
    );
    expect(screen.getByText("One memory, on the web, Telegram and Discord")).toBeDefined();
    expect(screen.getByRole("link", { name: /Add to Discord/ }).getAttribute("href")).toContain(
      "client_id=1556955188798169228",
    );
    expect(screen.queryByRole("button", { name: /own this memory/i })).toBeNull();
  });
});

describe("me page, changes", () => {
  it("shows a change of mind next to the fact it replaced, marked when it is a guess", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", memoryEnabled: true, namespace: "hippo-guest:abc" },
        "/api/me/memories": {
          memories: [
            {
              id: "1",
              type: "correction",
              status: "stored",
              channel: "web",
              createdAt: "2026-10-02T00:00:00Z",
              blobId: "c1",
              expiresAt: null,
              ciphertextUrl: null,
              explorerUrl: null,
            },
          ],
        },
        "/api/me/changes": {
          changes: [
            {
              blobId: "c1",
              text: "We moved this project from pnpm to bun.",
              date: "2026-10-02T09:00:00Z",
              replaced: {
                blobId: "p1",
                text: "I only use pnpm.",
                date: "2026-09-30T09:00:00Z",
                certain: false,
              },
            },
          ],
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("We moved this project from pnpm to bun.")).toBeDefined();
    expect(container.querySelector("s")?.textContent).toBe("I only use pnpm.");
    expect(screen.getByText("probably")).toBeDefined();
  });
});

describe("me page, memory at work", () => {
  it("says how many answers used memory, and how often each memory was used", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", memoryEnabled: true, namespace: "hippo-guest:abc" },
        "/api/me/memories": {
          memories: [
            {
              id: "1",
              type: "profile",
              status: "stored",
              channel: "telegram",
              createdAt: "2026-10-01T00:00:00Z",
              blobId: "blob-1",
              expiresAt: null,
              ciphertextUrl: null,
              explorerUrl: null,
            },
          ],
        },
        "/api/me/usage": { answers: 50, withMemory: 34, uses: { "blob-1": 12 } },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("34 of 50")).toBeDefined();
    expect(screen.getByText("Answers that used your memory")).toBeDefined();
    expect(screen.getByText("68%")).toBeDefined();
    expect(await screen.findByText("12 answers")).toBeDefined();
  });

  it("shows no count before anyone has been answered", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", memoryEnabled: true, namespace: "hippo-guest:abc" },
        "/api/me/memories": { memories: [] },
        "/api/me/usage": { answers: 0, withMemory: 0, uses: {} },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await screen.findByText("Bring your memory from another assistant");
    expect(screen.queryByText("Answers that used your memory")).toBeNull();
  });
});

describe("me page, Claude Code", () => {
  const mount = (mode: "guest" | "owned") => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": {
          mode,
          memoryEnabled: true,
          namespace: mode === "owned" ? "hippo" : "hippo-guest:abc",
        },
        "/api/me/memories": { memories: [] },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
  };

  it("gives an owner the plugin, the login and the question to ask", async () => {
    mount("owned");
    expect(await screen.findByText("Use the same memory in Claude Code")).toBeDefined();
    expect(screen.getByText("/plugin install memwal@memwal-plugins")).toBeDefined();
    expect(screen.getByText(/namespace "hippo"/)).toBeDefined();
    expect(screen.queryByText(/Own your memory first/)).toBeNull();
  });

  it("tells a guest to own the memory first", async () => {
    mount("guest");
    expect(await screen.findByText(/Own your memory first/)).toBeDefined();
  });
});

describe("me page, import", () => {
  it("lists the facts in a pasted note and keeps only the ones left ticked", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({
      "/api/me": { mode: "guest", memoryEnabled: true, namespace: "hippo-guest:abc" },
      "/api/me/memories": { memories: [] },
      "/api/me/import/preview": {
        facts: [
          { type: "profile", text: "I build on Sui with TypeScript." },
          { type: "style", text: "Keep answers short." },
        ],
      },
      "/api/me/import": { saved: 1, known: 0, failed: 0 },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await user.type(
      await screen.findByLabelText("What another assistant knows about you"),
      "You build on Sui and like short answers.",
    );
    await user.click(screen.getByRole("button", { name: "Find facts" }));
    await user.click(await screen.findByLabelText("Keep: Keep answers short."));
    await user.click(screen.getByRole("button", { name: "Remember 1 fact" }));
    expect(await screen.findByText(/Kept 1\. Already known: 0\./)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/me/import",
      expect.objectContaining({
        body: JSON.stringify({
          facts: [{ type: "profile", text: "I build on Sui with TypeScript." }],
        }),
      }),
    );
  });
});

describe("me page, read it yourself", () => {
  const owner = `0x${"ab".repeat(32)}`;
  const account = `0x${"cd".repeat(32)}`;
  const stored = {
    id: "1",
    type: "profile",
    status: "stored",
    channel: "web",
    createdAt: "2026-10-01T00:00:00Z",
    blobId: "blob-1",
    expiresAt: null,
    ciphertextUrl: null,
    explorerUrl: null,
    accountId: account,
    textSha256: "0".repeat(64),
  };

  it("tells a guest their wallet cannot open hippo's account", async () => {
    vi.stubEnv("VITE_SEAL_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", memoryEnabled: true, namespace: "hippo-guest:abc" },
        "/api/me/memories": { memories: [{ ...stored, accountId: `0x${"ee".repeat(32)}` }] },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Read it yourself")).toBeDefined();
    expect(screen.getByText(/Only memory in an account you own/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Read with my wallet" })).toBeNull();
  });

  it("offers the owner a read with their own wallet", async () => {
    vi.stubEnv("VITE_SEAL_API_KEY", "test-key");
    wallet = { address: owner };
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": {
          mode: "owned",
          memoryEnabled: true,
          namespace: "hippo",
          walletAddress: owner,
          accountId: account,
          signedIn: true,
        },
        "/api/me/memories": { memories: [stored] },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    const button = await screen.findByRole("button", { name: "Read with my wallet" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("me page", () => {
  it("points an anonymous visitor at the chat instead of showing an empty table", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({ "/api/me": { mode: "anonymous" }, "/api/me/memories": { memories: [] } }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Nothing remembered yet")).toBeDefined();
    expect(screen.getByRole("link", { name: "Start chatting" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a guest their memories, with storage expiry and a blob link", async () => {
    const soon = new Date(Date.now() + 200 * 86_400_000).toISOString();
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": {
          mode: "guest",
          signedIn: false,
          memoryEnabled: true,
          namespace: "hippo-guest:abc",
          surveyUrl: null,
        },
        "/api/me/memories": {
          memories: [
            {
              id: "1",
              type: "profile",
              status: "stored",
              channel: "web",
              createdAt: new Date().toISOString(),
              blobId: "blob123",
              expiresAt: soon,
              ciphertextUrl: "https://aggregator.example/v1/blobs/blob123",
              explorerUrl: "https://walruscan.com/mainnet/blob/blob123",
            },
          ],
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/profile/));
    const seen = container.textContent ?? "";
    // Said once, not on every row: five identical "expires in 209d" was five
    // repetitions of one fact.
    expect(seen).toMatch(/Storage runs out in about 200 days/i);
    expect(seen).not.toMatch(/expires in 200d/i);
    // The blob id is what makes one row different from the next; without it
    // every profile memory written on the same day rendered identically.
    expect(seen).toMatch(/blob123/);
    expect(screen.getAllByRole("button", { name: /copy/i }).length).toBeGreaterThan(0);
    // The explorer link is now the blob id itself rather than the word "blob",
    // so the link names the thing it points at.
    expect(screen.getByRole("link", { name: /blob123/ }).getAttribute("href")).toContain("blob123");
    // Guests are told the memory is not theirs yet, which is the whole pitch.
    expect(seen).toMatch(/under its own account/i);
  });

  it("offers the memory as a file once something has reached Walrus, and says what it holds", async () => {
    const routes = stubFetch({
      "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, surveyUrl: null },
      "/api/me/memories": {
        memories: [
          {
            id: "1",
            type: "profile",
            status: "stored",
            channel: "web",
            createdAt: new Date().toISOString(),
            blobId: "blob123",
            expiresAt: null,
            ciphertextUrl: "https://aggregator.example/v1/blobs/blob123",
            explorerUrl: "https://walruscan.com/mainnet/blob/blob123",
          },
        ],
      },
    });
    const exportFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ coverage: { memories: 1, withText: 1, verified: 1 } }),
      headers: new Headers({
        "content-type": "application/json",
        "content-disposition": 'attachment; filename="hippo-memory-2026-09-24.json"',
      }),
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).includes("/api/me/export") ? exportFetch() : routes(input),
      ),
    );
    // jsdom can neither make object URLs nor follow a download.
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => {} }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    const full = await screen.findByRole("button", { name: /full record/i });
    // What the file holds is on the page before anyone downloads, not only inside it.
    expect(document.body.textContent).toMatch(/checked against the hash hippo recorded/i);
    full.click();
    await screen.findByText(/verified for/i);
    expect(exportFetch).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("offers no export before anything has reached Walrus", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, surveyUrl: null },
        "/api/me/memories": { memories: [] },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Right now hippo keeps/));
    expect(screen.queryByRole("button", { name: /full record/i })).toBeNull();
  });

  it("shows the team in brief and sends the rest to the team page", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, surveyUrl: null },
        "/api/me/memories": { memories: [] },
        "/api/me/team": {
          team: {
            name: "Platform",
            memberCount: 3,
            memories: [
              {
                id: "t1",
                type: "decision",
                status: "stored",
                createdAt: new Date().toISOString(),
                blobId: "teamblob1",
                explorerUrl: "https://walruscan.com/mainnet/blob/teamblob1",
                mine: true,
              },
              {
                id: "t2",
                type: "gotcha",
                status: "failed",
                createdAt: new Date().toISOString(),
                blobId: null,
                explorerUrl: null,
                mine: false,
              },
            ],
          },
        },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await screen.findByText("Team: Platform");
    const seen = document.body.textContent ?? "";
    expect(seen).toMatch(/3 members · 2 shared/);
    expect(seen).toMatch(/not part of yours: it lives in hippo's account/);
    expect(screen.getByRole("link", { name: "Open team" }).getAttribute("href")).toBe("/team");
    expect(seen).not.toMatch(/a teammate/);
    expect(screen.queryByRole("button", { name: "Leave the team" })).toBeNull();
  });

  it("points to the team page when there is no team", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, surveyUrl: null },
        "/api/me/memories": { memories: [] },
        "/api/me/team": { team: null },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await screen.findByText(/You are not in a team/);
    expect(document.body.textContent).toMatch(/your own memory stays yours/);
    expect(screen.getByRole("link", { name: "Start or join a team" }).getAttribute("href")).toBe(
      "/team",
    );
  });

  it("hides one memory from its row, and shows a hidden one as hidden rather than gone", async () => {
    const row = (id: string, blobId: string, hidden: boolean) => ({
      id,
      type: "profile",
      status: "stored",
      channel: "web",
      createdAt: new Date().toISOString(),
      blobId,
      expiresAt: null,
      ciphertextUrl: `https://aggregator.example/v1/blobs/${blobId}`,
      explorerUrl: `https://walruscan.com/mainnet/blob/${blobId}`,
      hidden,
    });
    const base = stubFetch({
      "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, surveyUrl: null },
      "/api/me/memories": { memories: [row("1", "keepblob1", false), row("2", "gonebl0b2", true)] },
    });
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/me/memories/visibility")) {
          posted.push(JSON.parse(String(init?.body)));
          return { ok: true, status: 200, json: async () => ({}) } as Response;
        }
        return base(input);
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Use again" });
    expect(screen.getByText("hidden")).toBeTruthy();
    screen.getByRole("button", { name: "Hide" }).click();
    await waitFor(() => expect(posted).toEqual([{ blobId: "keepblob1", hidden: true }]));
  });

  it("warns on a memory that is nearly gone, where the row is the right place", async () => {
    const soon = new Date(Date.now() + 9 * 86_400_000).toISOString();
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, namespace: "ns" },
        "/api/me/memories": {
          memories: [
            {
              id: "1",
              type: "profile",
              status: "stored",
              channel: "web",
              createdAt: new Date().toISOString(),
              blobId: "blobSoon",
              expiresAt: soon,
              ciphertextUrl: "https://aggregator.example/v1/blobs/blobSoon",
              explorerUrl: "https://walruscan.com/mainnet/blob/blobSoon",
            },
          ],
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/expires in 9d/i));
  });

  it("offers wallet sign-in when the browser is not signed in", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, namespace: "ns" },
        "/api/me/memories": { memories: [] },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Already own your memory/i));
  });

  it("does not ask to connect a wallet the sidebar already shows", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": {
          mode: "guest",
          signedIn: false,
          walletAddress: `0x${"ab".repeat(32)}`,
          memoryEnabled: true,
          namespace: "ns",
        },
        "/api/me/memories": { memories: [] },
        "/api/me/account": { account: null },
      }),
    );
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("guest")).toBeDefined());
    expect(screen.queryByRole("button", { name: /connect your sui wallet/i })).toBeNull();
    expect(screen.queryByText(/Already own your memory/i)).toBeNull();
  });
});

describe("team page", () => {
  type Reply = { status: number; body: unknown };
  type Call = { path: string; method: string; body: unknown };

  const teamRow = (id: string, status: string, mine: boolean, blobId: string | null) => ({
    id,
    type: "decision",
    status,
    createdAt: new Date().toISOString(),
    blobId,
    explorerUrl: blobId ? `https://walruscan.com/mainnet/blob/${blobId}` : null,
    mine,
    // The server never sends an author; if one ever slipped in, the page must not show it.
    by: "@alice",
  });

  const platform = {
    name: "Platform",
    memberCount: 3,
    memories: [teamRow("t1", "stored", true, "teamblob1"), teamRow("t2", "failed", false, null)],
  };

  function serveTeam(
    state: { team: unknown },
    handle: (path: string, method: string, body: unknown) => Reply | undefined = () => undefined,
  ): Call[] {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const path = url.split("?")[0] ?? "";
        const method = init?.method ?? "GET";
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
        calls.push({ path: url, method, body });
        const reply =
          handle(path, method, body) ??
          (path === "/api/me/team" && method === "GET"
            ? { status: 200, body: { team: state.team } }
            : { status: 404, body: {} });
        return {
          ok: reply.status < 400,
          status: reply.status,
          json: async () => reply.body,
        } as Response;
      }),
    );
    return calls;
  }

  function mountTeam() {
    return render(
      <MemoryRouter initialEntries={["/team"]}>
        <TeamPage />
      </MemoryRouter>,
    );
  }

  const posts = (calls: Call[], path: string) =>
    calls.filter((call) => call.method === "POST" && call.path === path);

  it("offers to start or join when there is no team, and shows the code once one is started", async () => {
    const state: { team: unknown } = { team: null };
    const calls = serveTeam(state, (path, method) => {
      if (path !== "/api/me/team" || method !== "POST") return undefined;
      state.team = { name: "Platform", memberCount: 1, memories: [] };
      return {
        status: 200,
        body: {
          team: { name: "Platform", memberCount: 1 },
          invite: { code: "K7QX2M", expiresInMinutes: 10 },
        },
      };
    });
    mountTeam();

    const name = await screen.findByLabelText("Team name");
    expect(screen.getByLabelText("Invite code")).toBeDefined();
    const seen = document.body.textContent ?? "";
    expect(seen).toMatch(/Your own memory stays yours/);
    expect(seen).toMatch(/lives in hippo's account, not in yours/);
    const start = screen.getByRole("button", { name: "Start the team" });
    expect((start as HTMLButtonElement).disabled).toBe(true);

    await userEvent.type(name, "Platform");
    await userEvent.click(start);

    await screen.findByText("K7QX2M");
    expect(posts(calls, "/api/me/team").map((call) => call.body)).toEqual([{ name: "Platform" }]);
    expect(document.body.textContent).toMatch(/works once, for 10 minutes, on any channel/);
    expect(screen.getByRole("button", { name: "Copy join command" })).toBeDefined();
    expect(screen.getByText("1 member", { exact: false })).toBeDefined();
    expect(screen.queryByLabelText("Team name")).toBeNull();
  });

  it("joins with a cleaned-up code, and shows the server's sentence when the code is spent", async () => {
    const calls = serveTeam({ team: null }, (path) =>
      path === "/api/me/team/join"
        ? { status: 404, body: { error: "That code is used or expired. Ask for a new one." } }
        : undefined,
    );
    mountTeam();

    const code = await screen.findByLabelText("Invite code");
    const join = screen.getByRole("button", { name: "Join the team" });
    await userEvent.type(code, "k7q-x2o");
    expect((join as HTMLButtonElement).disabled).toBe(true);
    await userEvent.clear(code);
    await userEvent.type(code, " k7q-x2m ");
    expect((join as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(join);

    await screen.findByText("That code is used or expired. Ask for a new one.");
    expect(posts(calls, "/api/me/team/join").map((call) => call.body)).toEqual([
      { code: "K7QX2M" },
    ]);
    expect(screen.getByLabelText("Invite code")).toBeDefined();
  });

  it("shows the team and what it holds without naming anyone", async () => {
    serveTeam({ team: platform }, (path) =>
      path === "/api/me/team/invite"
        ? { status: 200, body: { code: "K7QX2M", expiresInMinutes: 10 } }
        : undefined,
    );
    mountTeam();

    await screen.findByText("Platform");
    const seen = document.body.textContent ?? "";
    expect(seen).toMatch(/3 members/);
    expect(seen).toMatch(/2 shared, 1 added by you/);
    expect(seen).toMatch(/a teammate/);
    expect(seen).toMatch(/just now · you/);
    expect(seen).not.toMatch(/alice/);
    // A failed team write is visible; it used to vanish after "Added".
    expect(seen).toMatch(/never reached Walrus/);
    expect(seen).toMatch(/no member owns it yet/);
    expect(screen.getByRole("link", { name: /teamblob1/ }).getAttribute("href")).toContain(
      "teamblob1",
    );

    await userEvent.click(screen.getByRole("button", { name: "Invite" }));
    await screen.findByText("K7QX2M");
  });

  it("adds a fact to the team only after warning it cannot be taken back, and shows the reply", async () => {
    const calls = serveTeam({ team: platform }, (path) =>
      path === "/api/me/team/remember"
        ? {
            status: 200,
            body: {
              saved: true,
              redacted: ["an API key"],
              message:
                'Added to "Platform". Everyone in the team can recall it from now on. I stripped an API key out of it first.',
            },
          }
        : undefined,
    );
    mountTeam();

    const box = await screen.findByLabelText("What the team should remember");
    expect(document.body.textContent).toMatch(/Everyone in the team will recall this/);
    expect(document.body.textContent).toMatch(/cannot be taken back/);
    const add = screen.getByRole("button", { name: "Add to the team" });
    await userEvent.type(box, "ab");
    expect((add as HTMLButtonElement).disabled).toBe(true);
    await userEvent.type(box, "c is how we deploy.");
    expect(document.body.textContent).toMatch(/21 \/ 1000/);
    await userEvent.click(add);

    await screen.findByText(/Added to "Platform"\. .* I stripped an API key out of it first\./);
    expect(posts(calls, "/api/me/team/remember").map((call) => call.body)).toEqual([
      { text: "abc is how we deploy." },
    ]);
    expect((box as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps the draft and says why when the team could not take it", async () => {
    serveTeam({ team: platform }, (path) =>
      path === "/api/me/team/remember"
        ? { status: 502, body: { error: "Could not add that to the team. Try again." } }
        : undefined,
    );
    mountTeam();

    const box = await screen.findByLabelText("What the team should remember");
    await userEvent.type(box, "Staging freezes on Friday.");
    await userEvent.click(screen.getByRole("button", { name: "Add to the team" }));

    await screen.findByText("Could not add that to the team. Try again.");
    expect((box as HTMLTextAreaElement).value).toBe("Staging freezes on Friday.");
  });

  it("searches the team's memory when asked, not as you type, and never says who added it", async () => {
    const calls = serveTeam({ team: platform }, (path) =>
      path === "/api/me/team/search"
        ? {
            status: 200,
            body: {
              results: [
                {
                  text: "Staging deploys freeze every Friday at 16:00.",
                  type: "decision",
                  relevance: 0.72,
                  blobId: "teamblob1",
                  explorerUrl: "https://walruscan.com/mainnet/blob/teamblob1",
                  mine: true,
                  by: "@alice",
                },
              ],
            },
          }
        : undefined,
    );
    mountTeam();

    const input = await screen.findByLabelText("Search the team's memory");
    await userEvent.type(input, "deploys");
    expect(calls.some((call) => call.path.startsWith("/api/me/team/search"))).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await screen.findByText("Staging deploys freeze every Friday at 16:00.");
    expect(calls.map((call) => call.path)).toContain("/api/me/team/search?q=deploys");
    const seen = document.body.textContent ?? "";
    expect(seen).toMatch(/relevance 0\.72/);
    expect(seen).toMatch(/added by you/);
    expect(seen).not.toMatch(/alice/);
  });

  it("says so when a team search finds nothing, and passes on a failure sentence", async () => {
    let fail = false;
    serveTeam({ team: platform }, (path) => {
      if (path !== "/api/me/team/search") return undefined;
      return fail
        ? { status: 502, body: { error: "Search failed: Walrus Memory is unreachable." } }
        : { status: 200, body: { results: [] } };
    });
    mountTeam();

    const input = await screen.findByLabelText("Search the team's memory");
    await userEvent.type(input, "sailing");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText(/Nothing in the team's memory is close/);

    fail = true;
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("Search failed: Walrus Memory is unreachable.");
  });

  it("leaves only after the dialog is confirmed, then offers to start or join again", async () => {
    const state: { team: unknown } = { team: platform };
    const calls = serveTeam(state, (path) => {
      if (path !== "/api/me/team/leave") return undefined;
      state.team = null;
      return { status: 200, body: { left: "Platform" } };
    });
    mountTeam();

    await userEvent.click(await screen.findByRole("button", { name: "Leave the team" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toMatch(/What you added stays with the team/);
    expect(dialog.textContent).toMatch(/cannot be deleted/);
    expect(posts(calls, "/api/me/team/leave")).toHaveLength(0);

    await userEvent.click(within(dialog).getByRole("button", { name: "Stay" }));
    expect(posts(calls, "/api/me/team/leave")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Leave the team" }));
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Leave" }),
    );
    await screen.findByLabelText("Team name");
    expect(posts(calls, "/api/me/team/leave")).toHaveLength(1);
  });

  it("sends a visitor hippo does not know yet to the chat instead of offering forms that would fail", async () => {
    const calls = serveTeam({ team: null }, (path, method) =>
      path === "/api/me/team" && method === "GET"
        ? { status: 200, body: { known: false, team: null } }
        : undefined,
    );
    mountTeam();

    await screen.findByText("No team yet");
    expect(screen.getByRole("link", { name: "Start chatting" }).getAttribute("href")).toBe("/");
    expect(screen.queryByLabelText("Team name")).toBeNull();
    expect(screen.queryByLabelText("Invite code")).toBeNull();
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
  });

  it("shows a placeholder while loading and a sentence when the team cannot be read", async () => {
    serveTeam({ team: null }, (path, method) =>
      path === "/api/me/team" && method === "GET"
        ? { status: 500, body: { error: "Could not read your team right now." } }
        : undefined,
    );
    const { container } = mountTeam();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    await screen.findByText("Could not read your team right now.");
    expect(container.querySelector('[data-slot="skeleton"]')).toBeNull();
  });
});

describe("me page, on chain", () => {
  const account = `0x${"cd".repeat(32)}`;
  const hippoKey = "f0".repeat(32);

  const routes = (mode: "guest" | "owned") => ({
    "/api/me": { mode, signedIn: false, memoryEnabled: true, namespace: "hippo" },
    "/api/me/memories": { memories: [] },
    "/api/me/account": {
      account: {
        accountId: account,
        explorerUrl: `https://suiscan.xyz/mainnet/object/${account}`,
        owner: `0x${"11".repeat(32)}`,
        ownerUrl: `https://suiscan.xyz/mainnet/account/0x${"11".repeat(32)}`,
        active: true,
        yours: mode === "owned",
        delegates: [
          { label: "hippo (web:uy)", publicKeyHex: hippoKey, suiAddress: "0x1", isHippo: true },
          { label: "MCP Client", publicKeyHex: "ab".repeat(32), suiAddress: "0x2", isHippo: false },
        ],
      },
    },
  });

  it("shows the delegate list the contract enforces, and marks hippo's key", async () => {
    vi.stubGlobal("fetch", stubFetch(routes("owned")));
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Keys that can read/i));
    const seen = container.textContent ?? "";
    expect(seen).toMatch(/hippo \(web:uy\)/);
    expect(seen).toMatch(/MCP Client/);
    // The object must be reachable, or the claim is unverifiable.
    const link = container.querySelector(`a[href*="${account}"]`);
    expect(link?.getAttribute("href")).toContain(account);
    expect(link?.textContent ?? "").toMatch(/^0xcd\.\.\./);
    expect(link?.textContent?.endsWith("cd")).toBe(true);
  });

  it("offers revoke when the account is yours", async () => {
    vi.stubGlobal("fetch", stubFetch(routes("owned")));
    render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /revoke/i })).toBeDefined());
  });

  it("offers ownership instead when the memory is still hippo's", async () => {
    vi.stubGlobal("fetch", stubFetch(routes("guest")));
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /own this memory/i })).toBeDefined(),
    );
    expect(container.textContent ?? "").toMatch(/hippo's own account/i);
  });

  it("keeps the explorer link when the object cannot be read", async () => {
    // A node hiccup must not make the page claim there is no account.
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "owned", signedIn: false, memoryEnabled: true, namespace: "hippo" },
        "/api/me/memories": { memories: [] },
        "/api/me/account": {
          account: {
            accountId: account,
            explorerUrl: `https://suiscan.xyz/mainnet/object/${account}`,
            unreadable: true,
          },
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent ?? "").toMatch(/could not be read/i));
    const link = container.querySelector(`a[href*="${account}"]`);
    expect(link?.textContent ?? "").toMatch(/^0xcd\.\.\./);
    expect(link?.textContent?.endsWith("cd")).toBe(true);
  });
});

describe("me page, finding a memory", () => {
  const rows = (type: string, id: string) => ({
    id,
    type,
    status: "stored" as const,
    channel: "web",
    createdAt: new Date().toISOString(),
    blobId: `blob${id}`,
    expiresAt: null,
    ciphertextUrl: `https://aggregator.example/v1/blobs/blob${id}`,
    explorerUrl: `https://walruscan.com/mainnet/blob/blob${id}`,
  });

  const base = {
    "/api/me": { mode: "guest", signedIn: false, memoryEnabled: true, namespace: "hippo-guest:a" },
    "/api/me/memories": { memories: [rows("profile", "1"), rows("style", "2")] },
  };

  it("filters the list by type without asking the server", async () => {
    vi.stubGlobal("fetch", stubFetch(base));
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Type" })).toBeDefined());
    const rowCount = () => container.querySelectorAll("tbody tr").length;
    expect(rowCount()).toBe(2);

    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(screen.getByRole("option", { name: "style" }));
    expect(rowCount()).toBe(1);
    expect(container.textContent ?? "").toMatch(/style/);
  });

  it("reads the words back from Walrus when you search", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        ...base,
        "/api/me/search": {
          results: [
            {
              mine: true,
              text: "Uy deploys with Railway.",
              type: "profile",
              relevance: 0.72,
              blobId: "blobX",
              explorerUrl: "https://walruscan.com/mainnet/blob/blobX",
            },
            {
              mine: false,
              text: "Staging deploys freeze every Friday at 16:00.",
              type: "decision",
              relevance: 0.6,
              blobId: "teamBlob",
              explorerUrl: "https://walruscan.com/mainnet/blob/teamBlob",
            },
          ],
        },
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText(/search your memory/i)).toBeDefined());
    await userEvent.type(screen.getByLabelText(/search your memory/i), "how do I deploy");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));

    // The text is the whole point: it cannot come from Postgres, only Walrus.
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Uy deploys with Railway\./));
    expect(container.textContent ?? "").toMatch(/relevance 0\.72/);
    // A team memory comes back from recall too. It is marked, and only the
    // person's own memory offers to be hidden: hiding a team fact 404'd.
    const rows = [...container.querySelectorAll("li")].filter((li) =>
      li.textContent?.includes("relevance"),
    );
    const teamRow = rows.find((li) => li.textContent?.includes("Staging deploys"));
    const ownRow = rows.find((li) => li.textContent?.includes("Railway"));
    expect(teamRow?.textContent).toMatch(/team/);
    expect(teamRow?.querySelector("button")).toBeNull();
    expect(ownRow?.querySelector("button")?.getAttribute("aria-label")).toBe("stop using this");
  });

  it("surfaces a failed search as a toast instead of a stale red line", async () => {
    // A real failure shape: the relayer answers 502 with a message, which is
    // what the user should be told rather than "something went wrong".
    const inner = stubFetch(base);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/me/search")) {
          return {
            ok: false,
            status: 502,
            json: async () => ({ error: "Search failed: Walrus Memory is unreachable." }),
          } as Response;
        }
        return inner(input);
      }),
    );
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<MePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText(/search your memory/i)).toBeDefined());
    await userEvent.type(screen.getByLabelText(/search your memory/i), "anything");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Search failed/i)),
    );
  });

  it("says so when a search finds nothing rather than showing an empty box", async () => {
    vi.stubGlobal("fetch", stubFetch({ ...base, "/api/me/search": { results: [] } }));
    const { container } = render(
      <MemoryRouter>
        <MePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText(/search your memory/i)).toBeDefined());
    await userEvent.type(screen.getByLabelText(/search your memory/i), "sailing");
    await userEvent.click(screen.getByRole("button", { name: /^search$/i }));
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Nothing close to that/i));
  });
});

describe("search engines", () => {
  it("names the guide for search and points its canonical at the public domain", async () => {
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/me": { mode: "guest", surveyUrl: null },
        "/api/me/memories": { memories: [] },
      }),
    );
    render(
      <MemoryRouter>
        <GuidePage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(document.title).toMatch(/^How hippo works/));
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://ask-hippo.vercel.app/guide",
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
      "index, follow",
    );
  });

  it("keeps a page that is not one out of the index, with no canonical", async () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(
        "noindex, nofollow",
      ),
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe("an address that is not a page", () => {
  it("says so and offers a way back, rather than rendering nothing", () => {
    const { container } = render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(container.textContent ?? "").toMatch(/Nothing here/i);
    // Expired connect links are the likeliest way somebody lands here.
    expect(container.textContent ?? "").toMatch(/expire after ten minutes/i);
    expect(screen.getByRole("link", { name: /go to the chat/i })).toBeDefined();
  });
});

describe("theme", () => {
  /**
   * This jsdom has no localStorage, which is also why `lib/api.ts` guards every
   * access. The toggle must work with it and without it, so the tests supply a
   * minimal one rather than pretending the guard is unnecessary.
   */
  function fakeStorage() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
    };
  }

  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("localStorage", fakeStorage());
    // jsdom has no matchMedia; without it the toggle cannot read the system.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  const mount = () =>
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<p>hello</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

  it("applies the dark class and remembers the choice", async () => {
    mount();
    // The palette existed in index.css and nothing ever switched it on.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    const toggle = screen.getByRole("button", { name: /switch to dark/i });
    expect(toggle.className).toContain("size-9");
    await userEvent.click(toggle);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("hippo.theme")).toBe("dark");
  });

  it("honours a stored choice over the system preference", () => {
    localStorage.setItem("hippo.theme", "dark");
    mount();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(screen.getByRole("button", { name: /switch to light/i })).toBeDefined();
  });

  it("follows the system when nothing is stored", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    mount();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

describe("connect flow, driven end to end with a stand-in wallet", () => {
  const OWNER = `0x${"11".repeat(32)}`;
  const ACCOUNT = `0x${"22".repeat(32)}`;
  const REGISTRY = `0x${"33".repeat(32)}`;
  const TABLE = `0x${"44".repeat(32)}`;

  /** A registry whose table resolves to ACCOUNT only after `appearsAfter` looks. */
  function chainWith({ appearsAfter }: { appearsAfter: number }) {
    let looks = 0;
    return {
      getObject: async () => ({ object: { json: { accounts: { id: TABLE } } } }),
      getDynamicField: async () => {
        looks += 1;
        if (looks <= appearsAfter) return null;
        return {
          dynamicField: {
            value: { bcs: btoa(String.fromCharCode(...new Uint8Array(32).fill(0x22))) },
          },
        };
      },
    };
  }

  const token = {
    kind: "connect" as const,
    publicKey: "ab".repeat(32),
    label: "hippo (web:uy)",
    accountId: null,
  };
  const config = {
    network: "mainnet",
    relayerUrl: "https://relayer.example",
    packageId: `0x${"55".repeat(32)}`,
    registryId: REGISTRY,
  };

  function stub(routes: Record<string, unknown>, onDone?: (body: unknown) => Response) {
    const inner = stubFetch({ "/api/connect/": token, "/api/config": config, ...routes });
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/done")) {
        return onDone
          ? onDone(init?.body)
          : ({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response);
      }
      // No sponsor service in a test, so every sponsorship attempt fails and the
      // user-paid fallback runs. That fallback is the path that has never
      // executed anywhere, which makes it the one worth driving.
      if (url.includes("/sponsor")) {
        return {
          ok: false,
          status: 502,
          text: async () => '{"error":"no sponsor here"}',
        } as unknown as Response;
      }
      return inner(input);
    });
  }

  function renderConnect(kind: "connect" | "disconnect" = "connect") {
    return render(
      <MemoryRouter initialEntries={[`/${kind}/tok`]}>
        <Routes>
          <Route path={`/${kind}/:token`} element={<ConnectPage kind={kind} />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("creates the account, registers the key, and confirms, when the wallet pays", async () => {
    wallet = { address: OWNER };
    suiClientStub.core = chainWith({ appearsAfter: 1 });
    suiClientStub.getBalance = async () => ({ balance: { balance: "100000000" } });
    const done: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      stub({}, (body) => {
        done.push(body);
        return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
      }),
    );

    const { container } = renderConnect();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /grant access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /grant access/i }));

    await waitFor(() => expect(container.textContent ?? "").toMatch(/Your memory is yours/i), {
      timeout: 15_000,
    });
    // create_account then add_delegate_key, both signed by the wallet.
    expect(signAndExecute).toHaveBeenCalledTimes(2);
    // The server is told which account, and never told the wallet address,
    // because it reads the owner off chain instead.
    expect(String(done[0])).toContain(ACCOUNT);
    // Gas came from the user, so the page has to say so.
    expect(container.textContent ?? "").toMatch(/your wallet paid/i);
  }, 20_000);

  it("skips creation when the wallet already owns an account", async () => {
    wallet = { address: OWNER };
    suiClientStub.core = chainWith({ appearsAfter: 0 });
    suiClientStub.getBalance = async () => ({ balance: { balance: "100000000" } });
    vi.stubGlobal("fetch", stub({}));

    renderConnect();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /grant access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /grant access/i }));
    await waitFor(() => expect(signAndExecute).toHaveBeenCalled(), { timeout: 15_000 });
    // One transaction, not two: the contract allows one account per address.
    expect(signAndExecute).toHaveBeenCalledTimes(1);
  }, 20_000);

  it("refuses to spend a wallet that cannot pay, and says why", async () => {
    wallet = { address: OWNER };
    suiClientStub.core = chainWith({ appearsAfter: 0 });
    suiClientStub.getBalance = async () => ({ balance: { balance: "0" } });
    vi.stubGlobal("fetch", stub({}));

    const { container } = renderConnect();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /grant access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /grant access/i }));

    await waitFor(() => expect(container.textContent ?? "").toMatch(/holds no SUI/i), {
      timeout: 15_000,
    });
    // Never ask a wallet to sign something that will fail on chain.
    expect(signAndExecute).not.toHaveBeenCalled();
  }, 20_000);

  it("keeps retrying confirmation while the node catches up", async () => {
    wallet = { address: OWNER };
    suiClientStub.core = chainWith({ appearsAfter: 0 });
    suiClientStub.getBalance = async () => ({ balance: { balance: "100000000" } });
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      stub({}, () => {
        attempts += 1;
        // The server reads the account off chain and will not see the new key at
        // once, so it answers 409 until it does. Giving up here would leave a
        // user who paid gas in guest mode.
        return attempts < 2
          ? ({ ok: false, status: 409, json: async () => ({ error: "not yet" }) } as Response)
          : ({ ok: true, status: 200, json: async () => ({ ok: true }) } as Response);
      }),
    );

    const { container } = renderConnect();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /grant access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /grant access/i }));
    await waitFor(() => expect(container.textContent ?? "").toMatch(/Your memory is yours/i), {
      timeout: 15_000,
    });
    expect(attempts).toBeGreaterThan(1);
  }, 20_000);

  it("revokes, and will not try when the wallet owns nothing to revoke", async () => {
    wallet = { address: OWNER };
    suiClientStub.getBalance = async () => ({ balance: { balance: "100000000" } });

    suiClientStub.core = chainWith({ appearsAfter: 99 });
    vi.stubGlobal("fetch", stub({}));
    const { container, unmount } = renderConnect("disconnect");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /revoke access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /revoke access/i }));
    await waitFor(() =>
      expect(container.textContent ?? "").toMatch(/does not own a Walrus Memory account/i),
    );
    expect(signAndExecute).not.toHaveBeenCalled();
    unmount();

    suiClientStub.core = chainWith({ appearsAfter: 0 });
    vi.stubGlobal("fetch", stub({}));
    const second = renderConnect("disconnect");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /revoke access/i })).toBeDefined(),
    );
    await userEvent.click(screen.getByRole("button", { name: /revoke access/i }));
    await waitFor(() => expect(second.container.textContent ?? "").toMatch(/Access revoked/i), {
      timeout: 15_000,
    });
    expect(signAndExecute).toHaveBeenCalledTimes(1);
  }, 25_000);
});

describe("connect page", () => {
  it("says who pays for gas before asking for a wallet", async () => {
    const { ConnectPage } = await import("../features/connect/connect-page.tsx");
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/connect/": {
          kind: "connect",
          publicKey: "ab".repeat(32),
          label: "hippo (web:uy)",
          accountId: null,
        },
        "/api/config": {
          network: "mainnet",
          relayerUrl: "https://r",
          packageId: "0x1",
          registryId: "0x2",
        },
      }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/connect/tok"]}>
        <Routes>
          <Route path="/connect/:token" element={<ConnectPage kind="connect" />} />
        </Routes>
      </MemoryRouter>,
    );
    // Sponsorship is preferred but not guaranteed, so the page has to promise
    // the user they will be told before their own wallet is charged.
    await waitFor(() => expect(container.textContent ?? "").toMatch(/sponsors the gas/i));
    expect(container.textContent ?? "").toMatch(/your wallet pays instead/i);
    expect(screen.getByRole("button", { name: /connect your sui wallet/i })).toBeDefined();
  });

  it("reconnects the last wallet instead of asking to choose it again", async () => {
    const key = "sui-dapp-kit:wallet-connection-info";
    const memory = new Map<string, string>([
      [
        key,
        JSON.stringify({
          state: {
            lastConnectedWalletName: "Slush",
            lastConnectedAccountAddress: "0xabc",
          },
        }),
      ],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (item: string) => memory.get(item) ?? null,
      setItem: (item: string, value: string) => void memory.set(item, value),
      removeItem: (item: string) => void memory.delete(item),
    });
    installedWallets = [{ name: "Slush" }];
    let release: (value: { accounts: Array<{ address: string }> }) => void = () => undefined;
    connectWallet.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/connect/": {
          kind: "connect",
          publicKey: "ab".repeat(32),
          label: "hippo (web:uy)",
          accountId: null,
        },
        "/api/config": {
          network: "mainnet",
          relayerUrl: "https://r",
          packageId: "0x1",
          registryId: "0x2",
        },
      }),
    );
    render(
      <MemoryRouter initialEntries={["/connect/tok"]}>
        <Routes>
          <Route path="/connect/:token" element={<ConnectPage kind="connect" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("status", { name: /connecting your wallet/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /connect your sui wallet/i })).toBeNull();
    expect(connectWallet).toHaveBeenCalledWith({
      wallet: { name: "Slush" },
      accountAddress: "0xabc",
      silent: true,
    });
    release({ accounts: [] });
  });

  it("on a dead disconnect link, names /disconnect and offers no wallet", async () => {
    // Seen in the browser pass: "Run /connect again" on the revoke page, and a
    // wallet button under it for a transaction that could not happen.
    const { ConnectPage } = await import("../features/connect/connect-page.tsx");
    vi.stubGlobal(
      "fetch",
      stubFetch({
        "/api/config": {
          network: "mainnet",
          relayerUrl: "https://r",
          packageId: "0x1",
          registryId: "0x2",
        },
      }),
    );
    const { container } = render(
      <MemoryRouter initialEntries={["/disconnect/gone"]}>
        <Routes>
          <Route path="/disconnect/:token" element={<ConnectPage kind="disconnect" />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(container.textContent ?? "").toMatch(/expired or was already used/i),
    );
    expect(container.textContent ?? "").toMatch(/Run \/disconnect again/);
    expect(screen.queryByRole("button", { name: /connect your sui wallet/i })).toBeNull();
  });
});
