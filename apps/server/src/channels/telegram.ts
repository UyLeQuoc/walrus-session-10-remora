import { telegramCommands } from "../chat/command-catalog.ts";
import { handleIncoming } from "../chat/turn.ts";
import { describeFailure } from "../copy/index.ts";
import { redeemLinkCode } from "../identity/link.ts";
import { personByChannel, resolvePerson } from "../identity/persons.ts";
import { remoraService, runtime } from "../runtime/index.ts";
import { telegramHandler } from "./handlers.ts";
import { keepPolling } from "./polling.ts";
import { createRemoraBot } from "./remora-bot.ts";
import { keyboardOf, telegramBot } from "./telegram-bot.ts";
import type { ChannelAdapter } from "./types.ts";

/** H1 commands shown in Telegram's menu beside the hippo ones. */
const REMORA_COMMANDS = [
  { command: "remoras", description: "Your remoras and their status" },
  { command: "ask", description: "Ask your Researcher a question" },
  { command: "teach", description: "Teach your Wallet watcher a rule" },
  { command: "budget", description: "Budgets left and the burn rate" },
  { command: "approvals", description: "What's waiting for you" },
  { command: "pause", description: "Pause a remora" },
  { command: "panic", description: "Pause everything" },
];

const CHANNEL = "telegram";

export function telegramAdapter(): ChannelAdapter | null {
  const bot = telegramBot;
  if (!bot) return null;

  const remora = createRemoraBot({
    runtime,
    service: remoraService,
    ownerOf: async (id) => (await personByChannel(CHANNEL, id))?.walletAddress ?? null,
    link: async (id, name, code) => {
      const person = await resolvePerson(CHANNEL, id, name);
      const out = await redeemLinkCode(person, code);
      if (out.ok) return "Linked. Your remoras will reach you here. Try /remoras.";
      return out.reason === "redeemer-has-memories"
        ? "This chat already has its own memories, so it can't join that wallet. Run /link here and enter the code on the other side."
        : "That link has expired or was already used. Make a new one in the dashboard.";
    },
  });
  const handle = telegramHandler(handleIncoming);
  bot.on("message:text", async (ctx) => {
    try {
      const reply = await remora.command(
        { id: String(ctx.from.id), name: ctx.from.username ?? ctx.from.first_name },
        ctx.message.text,
      );
      if (!reply) return handle(ctx);
      const reply_markup = keyboardOf(reply.buttons);
      await ctx.reply(reply.text.slice(0, 4_000), {
        link_preview_options: { is_disabled: true },
        ...(reply_markup ? { reply_markup } : {}),
      });
    } catch (err) {
      console.error("[telegram] remora command failed", err);
      await ctx.reply(describeFailure(err));
    }
  });
  bot.on("callback_query:data", async (ctx) => {
    const text = await remora
      .callback({ id: String(ctx.from.id) }, ctx.callbackQuery.data)
      .catch(() => "That didn't work. Try again from the dashboard.");
    await ctx.answerCallbackQuery({ text: text.slice(0, 190) }).catch(() => {});
    if (text.length > 190 || text.includes("\n")) await ctx.reply(text).catch(() => {});
  });
  let stopping = false;

  return {
    name: CHANNEL,
    async start() {
      bot.catch((e) => console.error("[telegram]", e));
      await bot.api.setMyCommands([...REMORA_COMMANDS, ...telegramCommands()].slice(0, 100));
      // H3 (ADR-0115): the menu button opens the Mini App. Telegram takes https only.
      if (runtime.webBase.startsWith("https://"))
        await bot.api
          .setChatMenuButton({
            menu_button: {
              type: "web_app",
              text: "Remora",
              web_app: { url: `${runtime.webBase}/tg` },
            },
          })
          .catch((e) => console.error("[telegram] menu button", e));
      // Not `void bot.start()`: a 409 during a deploy overlap rejected it
      // unhandled and crashed the whole server. See polling.ts.
      void keepPolling({
        start: () =>
          bot.start({ onStart: (me) => console.log(`[telegram] @${me.username} polling`) }),
        stopped: () => stopping,
      });
    },
    async stop() {
      stopping = true;
      await bot.stop();
    },
  };
}
