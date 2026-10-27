import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Globe,
  MessagesSquare,
  Send,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import {
  CHAT_VS_MEMORY,
  CLAUDE_CODE_STEPS,
  COMMAND_GROUPS,
  MEMORY_FLOW,
  OWNERSHIP,
  PROOFS,
  SAMPLE_MEMORY,
} from "@/features/guide/guide-content";
import { DISCORD_BOT, TELEGRAM_BOT } from "@/lib/channels";
import { cn } from "@/lib/utils";

export function GuideSection({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight text-ob-text">{title}</h2>
        {lead ? <p className="text-md text-ob-muted">{lead}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center gap-1 text-ob-muted md:flex-col"
    >
      {label ? <code className="font-mono text-xs">{label}</code> : null}
      <ArrowRight className="size-4 rotate-90 md:rotate-0" />
    </div>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ob-accent-soft text-ob-accent-text [&_svg]:size-4">
      {children}
    </span>
  );
}

export function MemoryFlow() {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        {MEMORY_FLOW.map((step, index) => (
          <li key={step.title} className="contents">
            {index > 0 ? <Connector /> : null}
            <div className="flex flex-1 items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4 md:flex-col md:items-stretch">
              <div className="flex items-center justify-between">
                <IconTile>
                  <step.icon />
                </IconTile>
                <span className="hidden font-mono text-xs text-ob-muted md:inline">
                  0{index + 1}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-md text-ob-muted">{step.detail}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-1 rounded-ob-card border border-dashed border-ob-accent-strong p-3">
        <span className="text-xs text-ob-muted">What lands on Walrus, before encryption</span>
        <code className="font-mono text-xs break-all">{SAMPLE_MEMORY}</code>
      </div>
    </div>
  );
}

export function ChatVsMemory() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {CHAT_VS_MEMORY.map((side) => (
        <div
          key={side.title}
          className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
        >
          <p className="text-sm font-medium">{side.title}</p>
          <ul className="flex flex-col gap-2">
            {side.lines.map((line) => (
              <li
                key={line.text}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  line.yes ? "text-foreground" : "text-ob-muted line-through",
                )}
              >
                {line.yes ? (
                  <Check aria-label="yes" className="size-4 shrink-0 text-ob-accent-text" />
                ) : (
                  <X aria-label="no" className="size-4 shrink-0" />
                )}
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function OwnershipPath() {
  return (
    <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {OWNERSHIP.map((stage, index) => (
        <li key={stage.title} className="contents">
          {index > 0 ? <Connector label={stage.command} /> : null}
          <div className="flex flex-1 items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4">
            <IconTile>
              <stage.icon />
            </IconTile>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{stage.title}</p>
              <p className="text-md break-words text-ob-muted">{stage.where}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProofGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PROOFS.map((proof) => (
        <div
          key={proof.title}
          className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
        >
          <IconTile>
            <proof.icon />
          </IconTile>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm font-medium">{proof.title}</p>
            <p className="text-md text-ob-muted">{proof.detail}</p>
          </div>
          <Badge variant="outline">{proof.where}</Badge>
        </div>
      ))}
    </div>
  );
}

export function CommandGroups() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {COMMAND_GROUPS.map((group) => (
        <div
          key={group.title}
          className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4"
        >
          <p className="text-xs font-medium text-ob-muted">{group.title}</p>
          <ul className="flex flex-col gap-2">
            {group.commands.map(([command, what]) => (
              <li key={command} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <code className="rounded-ob-sm bg-ob-control-hover px-1.5 py-0.5 font-mono text-xs">
                  {command}
                </code>
                <span className="text-ob-muted">{what}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function ClaudeCodeSteps() {
  return (
    <ol className="flex flex-col gap-2">
      {CLAUDE_CODE_STEPS.map((step, index) => (
        <li
          key={step}
          className="flex items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-3"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ob-control-hover font-mono text-xs">
            {index + 1}
          </span>
          <code className="min-w-0 flex-1 font-mono text-xs [overflow-wrap:anywhere]">{step}</code>
          <CopyButton value={step} label="step" />
        </li>
      ))}
    </ol>
  );
}

const CHANNELS = [
  { icon: Globe, name: "Web", detail: "remora.vercel.app", href: null },
  { icon: Send, name: "Telegram", detail: TELEGRAM_BOT.handle, href: TELEGRAM_BOT.url },
  {
    icon: MessagesSquare,
    name: "Discord",
    detail: "Add to a server, then DM",
    href: DISCORD_BOT.url,
  },
] as const;

export function ChannelPair() {
  return (
    <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      {CHANNELS.map((channel, index) => {
        const body = (
          <>
            <IconTile>
              <channel.icon />
            </IconTile>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium">{channel.name}</p>
              <p className="text-md break-words text-ob-muted">{channel.detail}</p>
            </div>
            {channel.href ? <ArrowUpRight className="size-4 shrink-0 text-ob-muted" /> : null}
          </>
        );
        return (
          <li key={channel.name} className="contents">
            {index > 0 ? <ChannelLink /> : null}
            {channel.href ? (
              <a
                href={channel.href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4 transition-colors hover:bg-ob-control-hover"
              >
                {body}
              </a>
            ) : (
              <div className="flex flex-1 items-center gap-3 rounded-ob-card border border-ob-border-grouped bg-ob-grouped p-4">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ChannelLink() {
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center gap-1 text-ob-muted md:flex-col"
    >
      <code className="font-mono text-xs">/link</code>
      <ArrowLeftRight className="size-4 rotate-90 md:rotate-0" />
    </div>
  );
}
