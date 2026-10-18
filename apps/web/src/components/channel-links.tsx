import { ArrowUpRight, MessagesSquare, Send } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DISCORD_BOT, TELEGRAM_BOT } from "@/lib/channels";

function ChannelRow({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-md px-1 py-1 text-sm font-medium transition-colors hover:bg-brand/15 [&_svg]:size-4"
    >
      <span className="text-brand">{icon}</span>
      {label}
      <ArrowUpRight className="ml-auto text-muted-foreground" />
    </a>
  );
}

export function ChannelsCard() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-brand/30 bg-brand/10 p-2 group-data-[collapsible=icon]:hidden">
      <ChannelRow href={TELEGRAM_BOT.url} icon={<Send />} label="hippo on Telegram" />
      <ChannelRow href={DISCORD_BOT.url} icon={<MessagesSquare />} label="Add hippo to Discord" />
      <p className="px-1 pt-1 text-xs text-muted-foreground">
        One memory everywhere: type /link here, then send the code to the bot.
      </p>
    </div>
  );
}

export function TelegramButton() {
  return (
    <Button asChild variant="outline">
      <a href={TELEGRAM_BOT.url} target="_blank" rel="noreferrer">
        <Send className="text-brand" />
        Open in Telegram
      </a>
    </Button>
  );
}

export function DiscordButton() {
  return (
    <Button asChild variant="outline">
      <a href={DISCORD_BOT.url} target="_blank" rel="noreferrer">
        <MessagesSquare className="text-brand" />
        Add to Discord
      </a>
    </Button>
  );
}
