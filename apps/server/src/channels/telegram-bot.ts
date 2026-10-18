/**
 * One grammY `Bot` per process, shared by the polling adapter (telegram.ts) and the remora notifier
 * (H5), so notifications go out even when this server doesn't poll (CHANNELS=off).
 */
import { Bot } from "grammy";
import { env } from "../env/load.ts";
import type { Notice } from "../runtime/notify.ts";
import { keyboardOf } from "./keyboard.ts";

export { keyboardOf };

export const telegramBot: Bot | null = env.TELEGRAM_BOT_TOKEN
  ? new Bot(env.TELEGRAM_BOT_TOKEN)
  : null;

export async function sendNotice(bot: Bot, chatId: string, n: Notice): Promise<void> {
  const reply_markup = keyboardOf(n.buttons);
  await bot.api.sendMessage(chatId, n.text.slice(0, 4_000), {
    link_preview_options: { is_disabled: true },
    ...(reply_markup ? { reply_markup } : {}),
  });
}
