/**
 * One grammY `Bot` per process, shared by the polling adapter (telegram.ts) and the remora notifier
 * (H5), so notifications go out even when this server doesn't poll (CHANNELS=off).
 */
import { Bot } from "grammy";
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "grammy/types";
import { env } from "../env/load.ts";
import type { Notice } from "../runtime/notify.ts";

export const telegramBot: Bot | null = env.TELEGRAM_BOT_TOKEN
  ? new Bot(env.TELEGRAM_BOT_TOKEN)
  : null;

/** Telegram refuses URL buttons that aren't public https, so local dashboard links are dropped. */
export function keyboardOf(buttons: Notice["buttons"]): InlineKeyboardMarkup | undefined {
  const row = (buttons ?? []).flatMap((b): InlineKeyboardButton[] =>
    b.url
      ? /^https:\/\//.test(b.url) && !/^https:\/\/(localhost|127\.)/.test(b.url)
        ? [{ text: b.label, url: b.url }]
        : []
      : b.data
        ? [{ text: b.label, callback_data: b.data.slice(0, 64) }]
        : [],
  );
  return row.length ? { inline_keyboard: [row] } : undefined;
}

export async function sendNotice(bot: Bot, chatId: string, n: Notice): Promise<void> {
  const reply_markup = keyboardOf(n.buttons);
  await bot.api.sendMessage(chatId, n.text.slice(0, 4_000), {
    link_preview_options: { is_disabled: true },
    ...(reply_markup ? { reply_markup } : {}),
  });
}
