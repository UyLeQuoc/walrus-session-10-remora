/**
 * Something to click, for somebody who has thirty seconds (Q7; ADR-0105: varied, tested, routed).
 *
 * A pool of examples, four at a time, one of each kind where the account allows; "More ideas" shows
 * the next four. Each card goes where it works. `/chat` only remembers and recalls, so memory cards
 * fill its box, and a command card runs its command at once (they only read, and a filled `/`
 * would open the command menu instead). A Researcher pays and a Wallet watcher learns only in their own
 * thread, so those cards open it with the text filled in, and are left out for a kind you don't
 * have. Every example in the pool was run once on testnet (`EXAMPLES=1`, examples.spec.ts).
 *
 * The reload card is the demonstration: a page with no history cannot be answering from memory. A
 * normal reload restores the open chat, so it clears that id first, and the empty page still has to
 * answer from Walrus.
 */

import type { RemoraView } from "@remora/schema";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bell,
  BellRing,
  CloudRain,
  Database,
  EyeOff,
  FileText,
  Fingerprint,
  Gift,
  GitBranch,
  Lock,
  MessageSquareText,
  Newspaper,
  Package,
  RotateCcw,
  Shuffle,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ExampleKind = "pays" | "learns" | "remembers" | "proves" | "briefs";
/**
 * Where an example works: the chat itself, a Researcher's (scout) or Wallet watcher's thread, or a
 * Briefer's page (ADR-0106).
 */
export type ExampleTarget = "chat" | "scout" | "sentinel" | "briefer";

export interface Example {
  kind: ExampleKind;
  target: ExampleTarget;
  icon: LucideIcon;
  /** What the card says. */
  text: string;
  /**
   * What goes in the box, when it isn't the text: a command, a full link, or (a function) a question
   * about the signed-in owner's own wallet. A card whose fill needs an owner hides without one.
   */
  fill?: string | ((owner: string) => string);
  reload?: true;
}

export const KIND_LOOK: Record<ExampleKind, { label: string; tone: string }> = {
  pays: { label: "Researcher pays", tone: "bg-ob-accent-soft text-ob-accent-text" },
  learns: { label: "Wallet watcher learns", tone: "bg-ob-success-soft text-ob-success-text" },
  remembers: { label: "Memory", tone: "bg-ob-warning-soft text-ob-warning-text" },
  proves: { label: "Proof", tone: "bg-ob-control text-ob-secondary" },
  briefs: { label: "Briefer", tone: "bg-ob-accent-soft text-ob-accent-text" },
};

/** In the order a set is dealt: one of each kind, then the next of each. */
export const POOL: Example[] = [
  { kind: "pays", target: "scout", icon: Package, text: "Is package 0x2 safe to depend on?" },
  {
    kind: "learns",
    target: "sentinel",
    icon: EyeOff,
    text: "Ignore incoming SUI under 0.01",
  },
  {
    kind: "remembers",
    target: "chat",
    icon: Database,
    text: "Remember that I build on Sui testnet and settle in USDC",
  },
  {
    kind: "proves",
    target: "chat",
    icon: Fingerprint,
    text: "Where does my memory live?",
    fill: "/whoami",
  },
  { kind: "pays", target: "scout", icon: Trophy, text: "What are the odds for tonight's match?" },
  {
    kind: "learns",
    target: "sentinel",
    icon: Bell,
    text: "Ping me about outgoing USDC over 1",
  },
  {
    kind: "remembers",
    target: "chat",
    icon: RotateCcw,
    text: "Reload, then ask what you remember",
    reload: true,
  },
  {
    kind: "proves",
    target: "chat",
    icon: MessageSquareText,
    text: "What do you remember about me?",
    fill: "/memory",
  },
  {
    kind: "pays",
    target: "scout",
    icon: FileText,
    text: "Summarize https://docs.wal.app in three lines",
  },
  { kind: "learns", target: "sentinel", icon: Gift, text: "Mute airdrops and unknown tokens" },
  {
    kind: "remembers",
    target: "chat",
    icon: Database,
    text: "Remember that I like short answers with sources",
  },
  {
    kind: "proves",
    target: "chat",
    icon: Lock,
    text: "What's stored, and for how long?",
    fill: "/privacy",
  },
  // ADR-0106: the services added in U16, each run on testnet (examples.spec.ts).
  {
    kind: "pays",
    target: "scout",
    icon: Wallet,
    text: "X-ray my wallet",
    fill: (owner) => `What does wallet ${owner} hold?`,
  },
  {
    kind: "learns",
    target: "sentinel",
    icon: BellRing,
    text: "Ping me about incoming USDC over 100",
  },
  {
    kind: "pays",
    target: "scout",
    icon: TrendingUp,
    text: "What are SUI and WAL worth right now?",
  },
  { kind: "pays", target: "scout", icon: CloudRain, text: "Will it rain in Hanoi tomorrow?" },
  {
    kind: "pays",
    target: "scout",
    icon: GitBranch,
    text: "How healthy is MystenLabs/walrus on GitHub?",
    fill: "How healthy is https://github.com/MystenLabs/walrus?",
  },
  // A Briefer's card opens its page, where Run now sends the brief.
  { kind: "briefs", target: "briefer", icon: Newspaper, text: "Send my morning brief now" },
];

/** The question the reload card asks once the page is back. */
export const RELOAD_ASK = "What do you remember about me?";

/** The remora a kind's cards open: the first live one, else the first in practice. */
export function remoraFor(roster: RemoraView[], template: "scout" | "sentinel" | "briefer") {
  const mine = roster.filter((r) => r.template === template);
  return mine.find((r) => r.status === "active") ?? mine.find((r) => r.status === "shadow") ?? null;
}

/** The `n`th set of four from what this account can use, wrapping around. */
export function exampleSet(usable: Example[], n: number, size = 4): Example[] {
  if (usable.length <= size) return usable;
  const start = (n * size) % usable.length;
  return Array.from({ length: size }, (_, i) => usable[(start + i) % usable.length] as Example);
}

/** What a card puts in the box, or null when it needs an owner and there's none. */
export function fillOf(e: Example, owner: string | null): string | null {
  if (typeof e.fill === "function") return owner ? e.fill(owner) : null;
  return e.fill ?? e.text;
}

export function Examples({
  roster,
  owner = null,
  onPick,
  onRun,
  onReloadAndAsk,
  onOpenThread,
  onOpenPage,
}: {
  /** The account's remoras; a kind with none has no cards. */
  roster: RemoraView[];
  /** The signed-in owner's address, for cards about their own wallet. */
  owner?: string | null;
  onPick: (text: string) => void;
  /** Sends a command card's command. */
  onRun: (command: string) => void;
  onReloadAndAsk: (text: string) => void;
  onOpenThread: (remoraId: string, text: string) => void;
  /** A Briefer's card opens its page. */
  onOpenPage?: (remoraId: string) => void;
}) {
  const [round, setRound] = useState(0);
  const scout = remoraFor(roster, "scout");
  const sentinel = remoraFor(roster, "sentinel");
  const briefer = remoraFor(roster, "briefer");
  const remoraOf = (t: ExampleTarget) =>
    t === "scout" ? scout : t === "sentinel" ? sentinel : t === "briefer" ? briefer : null;
  const usable = POOL.filter(
    (e) =>
      (e.target === "chat" || remoraOf(e.target)) &&
      (e.target !== "briefer" || onOpenPage) &&
      fillOf(e, owner) !== null,
  );
  const shown = exampleSet(usable, round);
  const pick = (e: Example) => {
    const text = fillOf(e, owner) ?? e.text;
    if (e.reload) return onReloadAndAsk(RELOAD_ASK);
    const remora = remoraOf(e.target);
    if (remora && e.target === "briefer") return onOpenPage?.(remora.id);
    if (remora) return onOpenThread(remora.id, text);
    if (text.startsWith("/")) return onRun(text);
    onPick(text);
  };
  return (
    <div className="flex w-full flex-col gap-2">
      <ul className="grid w-full gap-2 sm:grid-cols-2" aria-label="Examples">
        {shown.map((e) => {
          const look = KIND_LOOK[e.kind];
          const remora = remoraOf(e.target);
          return (
            <li key={e.text} className="flex">
              <button
                type="button"
                data-slot="example"
                data-kind={e.kind}
                title={remora ? `Opens ${remora.name}` : undefined}
                className="liquid-glass group flex w-full items-start gap-3 rounded-ob-card p-3 text-left transition-colors hover:bg-white/30 dark:hover:bg-white/10"
                onClick={() => pick(e)}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-ob-md [&_svg]:size-4",
                    look.tone,
                  )}
                  aria-hidden
                >
                  <e.icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-xs text-ob-muted">{look.label}</span>
                  <span className="text-sm text-ob-text">{e.text}</span>
                </span>
                {remora ? (
                  <ArrowUpRight
                    className="size-3.5 shrink-0 text-ob-muted opacity-60 group-hover:opacity-100"
                    aria-label={`opens ${remora.name}`}
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {usable.length > 4 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-end text-ob-muted"
          onClick={() => setRound((n) => n + 1)}
        >
          <Shuffle /> More ideas
        </Button>
      ) : null}
    </div>
  );
}

export { rememberPendingAsk, takePendingAsk } from "@/features/chat/pending-ask";
