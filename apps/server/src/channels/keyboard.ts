/** Notice buttons → a Telegram inline keyboard (pure, so it is testable without a bot or env). */
import type { InlineKeyboardButton, InlineKeyboardMarkup } from "grammy/types";
import type { Notice } from "../runtime/notify.ts";

const publicUrl = (u: string) => /^https:\/\//.test(u) && !/^https:\/\/(localhost|127\.)/.test(u);

/**
 * Telegram refuses URL buttons that aren't public https: such a button falls back to its callback
 * data when it has one (e.g. "Why?" answers in the chat) and is dropped otherwise.
 */
export function keyboardOf(buttons: Notice["buttons"]): InlineKeyboardMarkup | undefined {
  const row = (buttons ?? []).flatMap((b): InlineKeyboardButton[] =>
    b.url && publicUrl(b.url)
      ? [{ text: b.label, url: b.url }]
      : b.data
        ? [{ text: b.label, callback_data: b.data.slice(0, 64) }]
        : [],
  );
  return row.length ? { inline_keyboard: [row] } : undefined;
}
