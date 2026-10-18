/**
 * What each chat platform does with one incoming message, apart from the
 * platform clients and the environment.
 *
 * The adapters were written, typechecked and never run: Telegram had never
 * delivered a message and Discord and Slack had never connected. Each adapter
 * now only wires its client to one of these, which take the turn handler as an
 * argument, so the translation — who is talking, what they said, how the reply
 * and any files go back — is tested in CI with fake clients.
 */
import { InputFile } from "grammy";
import type { IncomingMessage, TurnReply } from "../chat/turn.ts";
import { describeFailure } from "../copy.ts";
import { chunk } from "./chunk.ts";

export type Handle = (msg: IncomingMessage) => Promise<TurnReply>;

// ─── Telegram ────────────────────────────────────────────────────────────────

export interface TelegramContext {
  from: { id: number; username?: string; first_name: string };
  chat: { id: number };
  message: { text: string };
  reply(text: string, other?: unknown): Promise<unknown>;
  replyWithChatAction(action: "typing"): Promise<unknown>;
  replyWithDocument(document: InputFile): Promise<unknown>;
}

/** Telegram caps a message at 4096 characters; chunk leaves room below that. */
export function telegramHandler(handle: Handle, typingEveryMs = 5_000) {
  return async (ctx: TelegramContext): Promise<void> => {
    const typing = setInterval(
      () => void ctx.replyWithChatAction("typing").catch(() => {}),
      typingEveryMs,
    );
    void ctx.replyWithChatAction("typing").catch(() => {});
    try {
      const reply = await handle({
        channel: "telegram",
        externalId: String(ctx.from.id),
        displayName: ctx.from.username ?? ctx.from.first_name,
        text: ctx.message.text,
        threadKey: `${ctx.chat.id}:${ctx.from.id}`,
      });
      for (const part of chunk(reply.text)) {
        await ctx.reply(part, { link_preview_options: { is_disabled: true } });
      }
      // /export: the .md and the .json, as documents the person keeps.
      for (const f of reply.files ?? []) {
        await ctx.replyWithDocument(new InputFile(Buffer.from(f.content, "utf8"), f.name));
      }
    } catch (err) {
      console.error("[telegram] turn failed", err);
      await ctx.reply(describeFailure(err));
    } finally {
      clearInterval(typing);
    }
  };
}

// ─── Discord ─────────────────────────────────────────────────────────────────

export interface DiscordMessage {
  author: { id: string; username: string; bot: boolean };
  channelId: string;
  content: string;
  /** True for a direct message; computed by the adapter from discord.js types. */
  isDirect: boolean;
  /** Whether the bot was @-mentioned. */
  mentionsBot: boolean;
  sendTyping?: () => Promise<unknown>;
  reply(
    content: string | { content: string; files: Array<{ attachment: Buffer; name: string }> },
  ): Promise<unknown>;
}

/** Discord caps a message at 2000 characters. */
const DISCORD_MAX = 1900;

export function discordHandler(handle: Handle) {
  return async (msg: DiscordMessage): Promise<void> => {
    if (msg.author.bot) return;
    // In a server channel, only when addressed; in a DM, always.
    if (!msg.isDirect && !msg.mentionsBot) return;
    const text = msg.content.replace(/<@!?\d+>/g, "").trim();
    if (!text) return;

    await msg.sendTyping?.().catch(() => {});
    try {
      const reply = await handle({
        channel: "discord",
        externalId: msg.author.id,
        displayName: msg.author.username,
        text,
        threadKey: `${msg.channelId}:${msg.author.id}`,
      });
      const parts = chunk(reply.text, DISCORD_MAX);
      const files = (reply.files ?? []).map((f) => ({
        attachment: Buffer.from(f.content, "utf8"),
        name: f.name,
      }));
      for (const [i, part] of parts.entries()) {
        // Attachments ride on the last part, so they arrive after the text.
        const last = i === parts.length - 1;
        await msg.reply(last && files.length ? { content: part, files } : part);
      }
    } catch (err) {
      console.error("[discord] turn failed", err);
      await msg.reply(describeFailure(err));
    }
  };
}

// ─── Slack ───────────────────────────────────────────────────────────────────

export interface SlackMessage {
  user?: string;
  team?: string;
  channel: string;
  text: string;
}

export function slackCommandText(command: string, text: string): string {
  return `${command} ${text}`.trim();
}

export function slackHandler(handle: Handle) {
  return async (event: SlackMessage, say: (text: string) => Promise<unknown>): Promise<void> => {
    // An event without a user used to be answered as "unknown", which put every
    // such sender into one shared person and one shared memory.
    if (!event.user) return;
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    if (!text) return;
    try {
      const reply = await handle({
        channel: "slack",
        externalId: `${event.team ?? "?"}/${event.user}`,
        text,
        threadKey: `${event.channel}:${event.user}`,
      });
      await say(reply.text);
    } catch (err) {
      console.error("[slack] turn failed", err);
      await say(describeFailure(err));
    }
  };
}
