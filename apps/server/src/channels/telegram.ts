import { Bot } from "grammy";
import { telegramCommands } from "../chat/command-catalog.ts";
import { handleIncoming } from "../chat/turn.ts";
import { env } from "../env/load.ts";
import { telegramHandler } from "./handlers.ts";
import { keepPolling } from "./polling.ts";
import type { ChannelAdapter } from "./types.ts";

const CHANNEL = "telegram";

export function telegramAdapter(): ChannelAdapter | null {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  const handle = telegramHandler(handleIncoming);
  bot.on("message:text", (ctx) => handle(ctx));
  let stopping = false;

  return {
    name: CHANNEL,
    async start() {
      bot.catch((e) => console.error("[telegram]", e));
      await bot.api.setMyCommands(telegramCommands());
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
