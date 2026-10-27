/**
 * N1 + N4 + N19: the activity feed, one bordered list with a divider per row (§5.4). Each item says
 * what happened in a sentence, links to its Wake ("Why?"), and answers and pings take 👍/👎 so the
 * remora learns which sources and pings matter.
 */
import type { FeedItem } from "@remora/schema";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usdc } from "@/lib/usdc";
import { SettingsGroup } from "@/openbot/pages";
import { api } from "./api";
import { WhyButton } from "./why-drawer";

const LABEL: Record<FeedItem["type"], string> = {
  action: "Action",
  message: "You",
  answer: "Answer",
  payment: "Paid",
  blocked: "Blocked",
  shadow: "Shadow",
  approval_needed: "Needs you",
  ping: "Ping",
  episode: "Ignored",
  rule_learned: "Learned",
  handoff: "Handoff",
  config_changed: "Edited",
};

/** openbot's soft tints: money and answers read as success, a block as danger, the rest neutral. */
const BADGE: Record<
  FeedItem["type"],
  "secondary" | "success" | "warning" | "destructive" | "accent"
> = {
  action: "secondary",
  message: "secondary",
  answer: "accent",
  payment: "success",
  blocked: "destructive",
  shadow: "warning",
  approval_needed: "warning",
  ping: "accent",
  episode: "secondary",
  rule_learned: "success",
  handoff: "secondary",
  config_changed: "secondary",
};

/** A sentence for the item; amounts in USDC where the payload has one. */
export function describeItem(e: FeedItem): string {
  const p = e.payload as { amount?: string; payee?: string; answer?: string };
  if (e.type === "payment" && p.amount && p.payee)
    return `Paid ${usdc(p.amount)} USDC to ${p.payee}`;
  if (e.type === "shadow" && p.amount && p.payee)
    return `Would have paid ${usdc(p.amount)} USDC to ${p.payee} (shadow mode)`;
  return e.summary;
}

function Feedback({ e }: { e: FeedItem }) {
  const [given, setGiven] = useState(e.feedback);
  const send = async (verdict: "useful" | "noise") => {
    const r = await api.feedback(e.id, verdict);
    if (!r.ok) return void toast.error(r.error);
    setGiven(verdict);
    if (r.data.learned !== "noted") toast.success(`Learned: ${r.data.learned}`);
  };
  return (
    <span className="flex gap-1">
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

export function FeedList({
  items,
  showRemora = false,
}: {
  items: FeedItem[];
  showRemora?: boolean;
}) {
  if (!items.length) return <p className="text-md text-ob-muted">Nothing yet.</p>;
  return (
    <SettingsGroup as="ol" aria-label="Activity">
      {items.map((e) => {
        const answer =
          e.type === "answer" ? String((e.payload as { answer?: string }).answer ?? "") : "";
        return (
          <li
            key={e.id}
            className="flex min-w-0 flex-col gap-1.5 px-4 py-3 text-md"
            data-testid="feed-item"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0">
                <Badge variant={BADGE[e.type]}>{LABEL[e.type]}</Badge>{" "}
                <span className="text-ob-muted">
                  {showRemora ? `${e.remora} · ` : ""}
                  <Time value={e.createdAt} /> ·{" "}
                </span>
                {describeItem(e)}
              </span>
              <span className="flex items-center gap-1">
                {e.type === "answer" || e.type === "ping" ? <Feedback e={e} /> : null}
                {e.receiptId ? <WhyButton eventId={e.id} /> : null}
              </span>
            </div>
            {answer ? <p className="whitespace-pre-wrap text-ob-secondary">{answer}</p> : null}
          </li>
        );
      })}
    </SettingsGroup>
  );
}
