/**
 * What happened, as a picture (ADR-0103): one icon per kind of event, the title, an amount chip and
 * a relative time. It replaces logs written as sentences.
 */
import {
  Ban,
  Bell,
  BookOpen,
  CircleCheck,
  CircleDollarSign,
  Clock,
  EyeOff,
  FlaskConical,
  MessageCircleQuestion,
  MessageSquareText,
  Pencil,
  Send,
  Sparkles,
  Unplug,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Time } from "@/components/app/time";
import { cn } from "@/lib/utils";

export type EventKind =
  | "paid"
  | "blocked"
  | "failed"
  | "learned"
  | "pinged"
  | "approved"
  | "asked"
  | "answered"
  | "acted"
  | "practice"
  | "ignored"
  | "handoff"
  | "edited"
  | "waiting"
  | "other";

const KIND: Record<EventKind, { icon: ReactNode; tone: string; name: string }> = {
  paid: { icon: <CircleDollarSign />, tone: "bg-ob-accent-soft text-ob-accent-text", name: "Paid" },
  blocked: { icon: <Ban />, tone: "bg-ob-danger-soft text-ob-danger-text", name: "Blocked" },
  failed: { icon: <Unplug />, tone: "bg-ob-control text-ob-muted", name: "Didn't go through" },
  learned: { icon: <Sparkles />, tone: "bg-ob-success-soft text-ob-success-text", name: "Learned" },
  pinged: { icon: <Bell />, tone: "bg-ob-warning-soft text-ob-warning-text", name: "Pinged you" },
  approved: {
    icon: <CircleCheck />,
    tone: "bg-ob-success-soft text-ob-success-text",
    name: "Approved",
  },
  asked: {
    icon: <MessageCircleQuestion />,
    tone: "bg-ob-control text-ob-secondary",
    name: "Asked",
  },
  answered: {
    icon: <MessageSquareText />,
    tone: "bg-ob-accent-soft text-ob-accent-text",
    name: "Answered",
  },
  acted: { icon: <Zap />, tone: "bg-ob-control text-ob-secondary", name: "Acted" },
  practice: {
    icon: <FlaskConical />,
    tone: "bg-ob-warning-soft text-ob-warning-text",
    name: "Practice",
  },
  ignored: { icon: <EyeOff />, tone: "bg-ob-control text-ob-muted", name: "Ignored" },
  handoff: { icon: <Send />, tone: "bg-ob-control text-ob-secondary", name: "Handed over" },
  edited: { icon: <Pencil />, tone: "bg-ob-control text-ob-muted", name: "Edited" },
  waiting: { icon: <Clock />, tone: "bg-ob-warning-soft text-ob-warning-text", name: "Waiting" },
  other: { icon: <BookOpen />, tone: "bg-ob-control text-ob-secondary", name: "Event" },
};

export type TimelineItem = {
  id: string;
  kind: EventKind;
  title: ReactNode;
  /** An amount chip, e.g. "0.01 USDC". */
  amount?: ReactNode;
  at: string;
  /** Actions on the right: Why?, 👍/👎, a link. */
  actions?: ReactNode;
  /** Who did it, when the list mixes remoras. */
  who?: ReactNode;
  /** A second line under the row: an answer's first lines. */
  detail?: ReactNode;
  testId?: string;
};

export function KindIcon({ kind, className }: { kind: EventKind; className?: string }) {
  const k = KIND[kind];
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5",
        k.tone,
        className,
      )}
    >
      {k.icon}
      <span className="sr-only">{k.name}</span>
    </span>
  );
}

export function Timeline({
  items,
  label,
  className,
}: {
  items: TimelineItem[];
  label: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("flex flex-col", className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-3 last:pb-0" data-testid={item.testId}>
          {i < items.length - 1 ? (
            <span aria-hidden className="absolute top-8 bottom-0 left-3.5 w-px bg-ob-border" />
          ) : null}
          <KindIcon kind={item.kind} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-1">
              {item.who ? <span className="shrink-0">{item.who}</span> : null}
              <span className="min-w-0 flex-1 truncate text-sm text-ob-text">{item.title}</span>
              {item.amount ? (
                <span className="shrink-0 rounded-full bg-ob-control px-2 py-0.5 text-xs font-medium tabular-nums text-ob-secondary">
                  {item.amount}
                </span>
              ) : null}
              <Time value={item.at} className="shrink-0 text-ob-muted" />
              {item.actions ? (
                <span className="flex shrink-0 items-center gap-1">{item.actions}</span>
              ) : null}
            </div>
            {item.detail}
          </div>
        </li>
      ))}
    </ol>
  );
}
