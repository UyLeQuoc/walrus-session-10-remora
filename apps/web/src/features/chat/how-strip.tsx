import { ArrowRight, Lock, MessageSquare, MessagesSquare, RotateCcw, Send } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { DISCORD_BOT, TELEGRAM_BOT } from "@/lib/channels";

const STEPS = [
  { icon: MessageSquare, label: "Tell it once" },
  { icon: Lock, label: "Sealed on Walrus" },
  { icon: RotateCcw, label: "Remembered in a new chat" },
];

export function HowStrip() {
  return (
    <div className="flex flex-col items-center gap-2">
      <ol className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {STEPS.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 ? <ArrowRight aria-hidden className="size-3.5" /> : null}
            <li className="flex items-center gap-1.5">
              <step.icon aria-hidden className="size-4 text-brand" />
              {step.label}
            </li>
          </Fragment>
        ))}
      </ol>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>On the web, Telegram and Discord, one memory.</span>
        <a
          href={TELEGRAM_BOT.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline"
        >
          <Send aria-hidden className="size-3.5" />
          Open in Telegram
        </a>
        <a
          href={DISCORD_BOT.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline"
        >
          <MessagesSquare aria-hidden className="size-3.5" />
          Add to Discord
        </a>
        <Link to="/guide" className="underline underline-offset-4">
          How it works
        </Link>
      </p>
    </div>
  );
}
