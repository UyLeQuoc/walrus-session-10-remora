/**
 * N1 + N4 + N19: the activity feed, drawn as a timeline (ADR-0103): an icon per kind of event, a
 * short title, the amount as a chip, the time, then Why? and 👍/👎 so the remora learns which
 * sources and pings matter. An answer's text shows two lines under it; a click shows the rest.
 */
import type { FeedItem } from "@remora/schema";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { RemoraAvatar } from "@/components/app/remora-avatar";
import { Button } from "@/components/ui/button";
import { Amount, Empty, type EventKind, Timeline } from "@/components/visual";
import { Markdown } from "@/features/chat/markdown";
import { payeeName } from "@/lib/payee";
import { plainEvent } from "@/lib/readable";
import { shortIds } from "@/lib/short-ids";
import { explorerTx, usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";
import { api } from "./api";
import { WhyButton } from "./why-drawer";

const KIND: Record<FeedItem["type"], EventKind> = {
  action: "acted",
  message: "asked",
  answer: "answered",
  payment: "paid",
  blocked: "blocked",
  shadow: "practice",
  approval_needed: "waiting",
  ping: "pinged",
  episode: "ignored",
  rule_learned: "learned",
  handoff: "handoff",
  config_changed: "edited",
};

/** A sentence for the item; amounts in USDC where the payload has one. */
export function describeItem(e: FeedItem): string {
  const p = e.payload as { amount?: string; payee?: string; answer?: string };
  if (e.type === "blocked" && refusedBy(e) === "service") return titleOf(e);
  if (e.type !== "payment" && e.type !== "shadow") return plainEvent(e.summary, payeeName);
  if (e.type === "payment" && p.amount && p.payee)
    return `Paid ${usdc(p.amount)} USDC to ${payeeName(p.payee)}`;
  if (e.type === "shadow" && p.amount && p.payee)
    return `Would have paid ${usdc(p.amount)} USDC to ${payeeName(p.payee)} (practice mode)`;
  return e.summary;
}

/**
 * A refused payment is "Blocked" only when a guard stopped it: the safety check, the per-payment cap,
 * the remora's state, or the Disc onchain (a Move abort, `E…`). A service that took no money or
 * didn't answer "didn't go through" (ADR-0103: the reviewers read every red "Blocked" as the limit).
 */
const GUARDS = /^(sonar\.|over_limit|remora\.|disc\.|E[A-Z])/;
export function refusedBy(e: Pick<FeedItem, "payload">): "guard" | "service" {
  const code = String((e.payload as { code?: string }).code ?? "");
  return GUARDS.test(code) ? "guard" : "service";
}

/** The row's title: who was paid when there's an amount (the chip carries it), else the summary. */
function titleOf(e: FeedItem): string {
  const p = e.payload as { amount?: string; payee?: string };
  if (e.type === "payment" && p.payee) return payeeName(p.payee);
  if (e.type === "shadow" && p.payee) return `Would pay ${payeeName(p.payee)}`;
  if (e.type === "blocked" && refusedBy(e) === "service") {
    const payee = /^Didn't pay (.+?):/.exec(e.summary)?.[1];
    return payee ? `${payee} didn't go through, nothing paid` : e.summary;
  }
  return plainEvent(firstLine(e.summary), payeeName);
}

/** A summary over several lines reads as its first line, without a dangling colon. */
const firstLine = (text: string) => (text.split("\n")[0] ?? text).replace(/:\s*$/, "");
const restLines = (text: string) => text.split("\n").slice(1).join("\n").trim();

function Feedback({ e }: { e: FeedItem }) {
  const [given, setGiven] = useState(e.feedback);
  const send = async (verdict: "useful" | "noise") => {
    const r = await api.feedback(e.id, verdict);
    if (!r.ok) return void toast.error(r.error);
    setGiven(verdict);
    if (r.data.learned !== "noted") toast.success(`Learned: ${r.data.learned}`);
  };
  return (
    <span className="flex gap-0.5">
      <Button
        type="button"
        size="icon-sm"
        variant={given === "useful" ? "secondary" : "ghost"}
        aria-label="Useful"
        aria-pressed={given === "useful"}
        onClick={() => void send("useful")}
      >
        <ThumbsUp />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant={given === "noise" ? "secondary" : "ghost"}
        aria-label="Noise"
        aria-pressed={given === "noise"}
        onClick={() => void send("noise")}
      >
        <ThumbsDown />
      </Button>
    </span>
  );
}

function AnswerText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <div data-ux-skip className={cn("w-full text-ob-secondary", !open && "line-clamp-2")}>
        <Markdown>{text}</Markdown>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-xs text-ob-muted hover:text-ob-text"
      >
        {open ? "Less" : "More"}
      </button>
    </div>
  );
}

export function FeedList({
  items,
  showRemora = false,
}: {
  items: FeedItem[];
  showRemora?: boolean;
}) {
  if (!items.length) return <Empty title="Nothing yet. Its work shows up here." mood="asleep" />;
  const row = (e: FeedItem) => {
    const p = e.payload as { amount?: string; answer?: string; digest?: unknown };
    const answer = e.type === "answer" ? String(p.answer ?? "") : "";
    return {
      id: e.id,
      kind: e.type === "blocked" && refusedBy(e) === "service" ? ("failed" as const) : KIND[e.type],
      title: <span title={e.summary}>{shortIds(titleOf(e))}</span>,
      amount:
        (e.type === "payment" || e.type === "shadow") && p.amount ? (
          <Amount value={p.amount} />
        ) : undefined,
      at: e.createdAt,
      who: showRemora ? (
        <Link
          to={`/remoras/${e.remoraId}`}
          className="flex items-center gap-1.5 text-xs font-medium text-ob-secondary hover:text-ob-text"
          data-ux-skip
        >
          <RemoraAvatar id={e.remoraId} size={18} still />
          <span className="max-w-32 truncate">{e.remora}</span>
        </Link>
      ) : undefined,
      actions: (
        <>
          {e.type === "payment" && typeof p.digest === "string" ? (
            <a
              className="link text-xs"
              href={explorerTx(e.network, p.digest)}
              target="_blank"
              rel="noreferrer"
              title={p.digest}
            >
              tx ↗
            </a>
          ) : null}
          {e.type === "answer" || e.type === "ping" ? <Feedback e={e} /> : null}
          {e.receiptId ? <WhyButton eventId={e.id} /> : null}
        </>
      ),
      detail: answer ? (
        <AnswerText text={answer} />
      ) : restLines(e.summary) ? (
        <p className="whitespace-pre-wrap text-xs text-ob-muted">{restLines(e.summary)}</p>
      ) : undefined,
      testId: "feed-item",
    };
  };
  // ADR-0103: grouped by day, the way the chat thread separates them.
  const groups: Array<{ day: string; items: FeedItem[] }> = [];
  for (const e of items) {
    const label = dayLabel(e.createdAt);
    const last = groups.at(-1);
    if (last?.day === label) last.items.push(e);
    else groups.push({ day: label, items: [e] });
  }
  return (
    <ul
      className="flex flex-col gap-3 rounded-xl border border-ob-border bg-ob-raised px-4 py-3"
      aria-label="Activity"
    >
      {groups.map((g) => (
        <li key={g.day} className="flex flex-col gap-2">
          <p className="text-xs font-medium text-ob-muted">{g.day}</p>
          <Timeline label={g.day} items={g.items.map(row)} />
        </li>
      ))}
    </ul>
  );
}

/** "Today", "Yesterday", "Oct 31". */
function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
