/**
 * N1 + N4 + N19: the activity feed. Each item says what happened in a sentence, links to its Wake
 * ("Why?"), and answers and pings take 👍/👎 so the remora learns which sources and pings matter.
 */
import type { FeedItem } from "@remora/schema";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usdc } from "@/lib/usdc";
import { api } from "./api";
import { WhyButton } from "./why-drawer";

const LABEL: Record<FeedItem["type"], string> = {
  action: "action",
  answer: "answer",
  payment: "paid",
  blocked: "blocked",
  shadow: "shadow",
  approval_needed: "needs you",
  ping: "ping",
  episode: "ignored",
  rule_learned: "learned",
  handoff: "handoff",
  config_changed: "edited",
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
        size="icon"
        variant={given === "useful" ? "secondary" : "ghost"}
        aria-label="Useful"
        onClick={() => void send("useful")}
      >
        <ThumbsUp />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={given === "noise" ? "secondary" : "ghost"}
        aria-label="Noise"
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
  if (!items.length) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ol className="flex flex-col gap-2" aria-label="Activity">
      {items.map((e) => {
        const answer =
          e.type === "answer" ? String((e.payload as { answer?: string }).answer ?? "") : "";
        return (
          <li
            key={e.id}
            className="flex flex-col gap-1 rounded-md border p-3 text-sm"
            data-testid="feed-item"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <Badge
                  variant={e.type === "blocked" || e.type === "ping" ? "destructive" : "outline"}
                >
                  {LABEL[e.type]}
                </Badge>{" "}
                <span className="text-muted-foreground">
                  {showRemora ? `${e.remora} · ` : ""}
                  {new Date(e.createdAt).toLocaleString()} ·{" "}
                </span>
                {describeItem(e)}
              </span>
              <span className="flex items-center gap-1">
                {e.type === "answer" || e.type === "ping" ? <Feedback e={e} /> : null}
                {e.receiptId ? <WhyButton eventId={e.id} /> : null}
              </span>
            </div>
            {answer ? <p className="whitespace-pre-wrap text-foreground">{answer}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
