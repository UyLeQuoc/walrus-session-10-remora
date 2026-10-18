/**
 * Each platform's handling of one message, against fake clients. None of these
 * adapters had ever run against its platform when these were written.
 */
import { InputFile } from "grammy";
import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage, TurnReply } from "../chat/turn.ts";
import { discordHandler, slackCommandText, slackHandler, telegramHandler } from "./handlers.ts";

const EXPORT_FILES = [
  { name: "hippo-memory-2026-09-25.md", mime: "text/markdown", content: "# Your memory" },
  { name: "hippo-memory-2026-09-25.json", mime: "application/json", content: "{}" },
];

function recordingHandle(reply: TurnReply | Error) {
  const seen: IncomingMessage[] = [];
  const handle = async (msg: IncomingMessage) => {
    seen.push(msg);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { handle, seen };
}

describe("telegram", () => {
  function ctx(text: string) {
    return {
      from: { id: 42, username: "mai", first_name: "Mai" },
      chat: { id: 7 },
      message: { text },
      reply: vi.fn(async (_text: string, _other?: unknown) => {}),
      replyWithChatAction: vi.fn(async (_action: "typing") => {}),
      replyWithDocument: vi.fn(async (_document: InputFile) => {}),
    };
  }

  it("turns a message into a turn keyed by user, and answers it", async () => {
    const { handle, seen } = recordingHandle({ text: "Noted.", command: false });
    const c = ctx("I use pnpm");
    await telegramHandler(handle)(c);
    expect(seen).toEqual([
      {
        channel: "telegram",
        externalId: "42",
        displayName: "mai",
        text: "I use pnpm",
        threadKey: "7:42",
      },
    ]);
    expect(c.reply).toHaveBeenCalledWith("Noted.", { link_preview_options: { is_disabled: true } });
  });

  it("splits a reply longer than Telegram allows", async () => {
    const long = Array.from({ length: 400 }, (_, i) => `line ${i} of a long /memory listing`).join(
      "\n",
    );
    const { handle } = recordingHandle({ text: long, command: true });
    const c = ctx("/memory");
    await telegramHandler(handle)(c);
    expect(c.reply.mock.calls.length).toBeGreaterThan(1);
    for (const [part] of c.reply.mock.calls as unknown as Array<[string]>) {
      expect(part.length).toBeLessThanOrEqual(4096);
    }
  });

  it("sends /export's two files as documents, after the text", async () => {
    const { handle } = recordingHandle({
      text: "Your memory, as files.",
      command: true,
      files: EXPORT_FILES,
    });
    const c = ctx("/export");
    await telegramHandler(handle)(c);
    expect(c.replyWithDocument).toHaveBeenCalledTimes(2);
    const sent = c.replyWithDocument.mock.calls.map(([f]) => f as unknown as InputFile);
    expect(sent.every((f) => f instanceof InputFile)).toBe(true);
    expect(sent.map((f) => f.filename)).toEqual(EXPORT_FILES.map((f) => f.name));
  });

  it("says what went wrong when the turn fails, instead of going quiet", async () => {
    const { handle } = recordingHandle(
      Object.assign(new Error("Too Many Requests"), { status: 429 }),
    );
    const c = ctx("hello");
    await telegramHandler(handle)(c);
    expect(c.reply).toHaveBeenCalledTimes(1);
    expect(String((c.reply.mock.calls[0] as unknown as [string])[0])).not.toBe("");
  });
});

describe("discord", () => {
  function msg(
    content: string,
    extra: Partial<{ isDirect: boolean; mentionsBot: boolean; bot: boolean }> = {},
  ) {
    return {
      author: { id: "u1", username: "mai", bot: extra.bot ?? false },
      channelId: "c1",
      content,
      isDirect: extra.isDirect ?? false,
      mentionsBot: extra.mentionsBot ?? true,
      sendTyping: vi.fn(async () => {}),
      reply: vi.fn(async (_content: unknown) => {}),
    };
  }

  it("answers a mention with the mention stripped out", async () => {
    const { handle, seen } = recordingHandle({ text: "Use bun.", command: false });
    const m = msg("<@123456> which package manager?");
    await discordHandler(handle)(m);
    expect(seen[0]).toMatchObject({
      channel: "discord",
      externalId: "u1",
      text: "which package manager?",
      threadKey: "c1:u1",
    });
    expect(m.reply).toHaveBeenCalledWith("Use bun.");
  });

  it("ignores other bots, and server messages that do not address it", async () => {
    const { handle, seen } = recordingHandle({ text: "x", command: false });
    await discordHandler(handle)(msg("hello", { bot: true }));
    await discordHandler(handle)(msg("hello", { mentionsBot: false }));
    expect(seen).toHaveLength(0);
  });

  it("answers every direct message", async () => {
    const { handle, seen } = recordingHandle({ text: "Hi.", command: false });
    await discordHandler(handle)(msg("hello", { isDirect: true, mentionsBot: false }));
    expect(seen).toHaveLength(1);
  });

  it("keeps each part under Discord's limit and attaches /export's files to the last", async () => {
    const long = "word ".repeat(1200);
    const { handle } = recordingHandle({ text: long, command: true, files: EXPORT_FILES });
    const m = msg("<@1> /export");
    await discordHandler(handle)(m);
    const calls = m.reply.mock.calls.map(
      ([c]) => c as unknown as string | { content: string; files: Array<{ name: string }> },
    );
    expect(calls.length).toBeGreaterThan(1);
    for (const c of calls)
      expect((typeof c === "string" ? c : c.content).length).toBeLessThanOrEqual(2000);
    const last = calls.at(-1);
    expect(typeof last).toBe("object");
    expect((last as { files: Array<{ name: string }> }).files.map((f) => f.name)).toEqual(
      EXPORT_FILES.map((f) => f.name),
    );
  });
});

describe("slack", () => {
  it("turns a slash command into the same text a typed command would be, for the same person", async () => {
    expect(slackCommandText("/memory", "search bun")).toBe("/memory search bun");
    expect(slackCommandText("/whoami", "")).toBe("/whoami");
    const { handle, seen } = recordingHandle({ text: "ok", command: true });
    const respond = vi.fn(async () => {});
    await slackHandler(handle)(
      { user: "U1", team: "T1", channel: "D1", text: slackCommandText("/memory", "search bun") },
      respond,
    );
    expect(seen[0]).toMatchObject({ externalId: "T1/U1", text: "/memory search bun" });
    expect(respond).toHaveBeenCalledWith("ok");
  });

  it("keys the person by team and user, and says the reply", async () => {
    const { handle, seen } = recordingHandle({ text: "Use bun.", command: false });
    const say = vi.fn(async () => {});
    await slackHandler(handle)(
      { user: "U1", team: "T1", channel: "C1", text: "<@UBOT> which package manager?" },
      say,
    );
    expect(seen[0]).toMatchObject({
      channel: "slack",
      externalId: "T1/U1",
      text: "which package manager?",
      threadKey: "C1:U1",
    });
    expect(say).toHaveBeenCalledWith("Use bun.");
  });

  it("ignores an event with no user rather than filing it under a shared one", async () => {
    // It used to become "T1/unknown": one person, one memory, for every such sender.
    const { handle, seen } = recordingHandle({ text: "x", command: false });
    const say = vi.fn(async () => {});
    await slackHandler(handle)({ team: "T1", channel: "C1", text: "hello" }, say);
    expect(seen).toHaveLength(0);
    expect(say).not.toHaveBeenCalled();
  });

  it("says what went wrong when the turn fails", async () => {
    const { handle } = recordingHandle(new Error("boom"));
    const say = vi.fn(async () => {});
    await slackHandler(handle)({ user: "U1", channel: "C1", text: "hello" }, say);
    expect(say).toHaveBeenCalledTimes(1);
  });
});
