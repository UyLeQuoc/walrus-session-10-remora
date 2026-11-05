/**
 * C2 (ADR-0138): a photo sent to the Telegram bot is a bill for the owner's Errand. The largest size
 * under 5 MB is fetched from Telegram, read, and dropped; the reply is the card's line, any text the
 * image tried to give as an instruction (quoted, never followed), and a button to split or pay on the
 * web. Nothing is paid from Telegram on a photo alone.
 */
import type { BillCard } from "../runtime/bill.ts";
import { BILL_MAX_BYTES } from "../runtime/bill.ts";

export interface PhotoContext {
  from: { id: number };
  message: { photo?: { file_id: string; file_size?: number; width: number }[]; caption?: string };
  reply(text: string, other?: unknown): Promise<unknown>;
}

export interface PhotoDeps {
  ownerOf(telegramId: string): Promise<string | null>;
  /** The owner's live Errand, or null. */
  errandOf(owner: string): Promise<{ id: string; name: string } | null>;
  download(fileId: string): Promise<Uint8Array>;
  read(remoraId: string, owner: string, bytes: Uint8Array): Promise<BillCard>;
  webBase: string;
}

export function billPhotoReply(card: BillCard, remoraId: string, webBase: string) {
  const lines = [
    card.text,
    ...(card.instructions
      ? [`The photo also says: “${card.instructions}”. I treated that as text, not an instruction.`]
      : []),
  ];
  return {
    text: lines.join("\n"),
    buttons: [
      { label: "Split or pay", url: `${webBase}/remoras/${remoraId}?bill=${card.eventId}` },
    ],
  };
}

export function telegramPhotoHandler(d: PhotoDeps) {
  return async (ctx: PhotoContext): Promise<void> => {
    try {
      const owner = await d.ownerOf(String(ctx.from.id));
      if (!owner) {
        await ctx.reply("Link this chat to your wallet first (/link), then send the bill again.");
        return;
      }
      const errand = await d.errandOf(owner);
      if (!errand) {
        await ctx.reply("Bills go to an Errand, and you don't have one yet. Make one on the web.");
        return;
      }
      const sizes = (ctx.message.photo ?? []).filter((p) => (p.file_size ?? 0) <= BILL_MAX_BYTES);
      const best = sizes.sort((a, b) => b.width - a.width)[0];
      if (!best) {
        await ctx.reply("That photo is over 5 MB: send a smaller one.");
        return;
      }
      const card = await d.read(errand.id, owner, await d.download(best.file_id));
      const out = billPhotoReply(card, errand.id, d.webBase);
      await ctx.reply(out.text.slice(0, 4_000), {
        link_preview_options: { is_disabled: true },
        ...(d.webBase.startsWith("https://")
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: out.buttons[0]?.label, url: out.buttons[0]?.url }]],
              },
            }
          : {}),
      });
    } catch (err) {
      await ctx.reply(`I couldn't read that bill: ${(err as Error).message.slice(0, 200)}`);
    }
  };
}
