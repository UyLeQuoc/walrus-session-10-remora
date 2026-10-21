/**
 * A conversation with remoras (ADR-0042): the owner's lines on the right, remora answers on the left,
 * events as small chips, approval cards inline, and Why? / 👍 / 👎 under remora answers and pings.
 */
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageContent } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { Markdown } from "@/features/chat/markdown";
import { api } from "@/features/remoras/api";
import { WhyButton } from "@/features/remoras/why-drawer";
import { cn } from "@/lib/utils";
import { InlineApproval } from "./inline-approval";
import { CHIP_TYPES, type Line, WHY_TYPES } from "./lines";

const CHIP_TONE: Partial<Record<NonNullable<Line["type"]>, string>> = {
  payment: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  blocked: "border-destructive/50 text-destructive",
  shadow: "border-amber-500/50 text-amber-700 dark:text-amber-300",
  rule_learned: "border-primary/40 text-primary",
};

function Feedback({ line }: { line: Line }) {
  const [given, setGiven] = useState(line.feedback);
  if (!line.eventId) return null;
  const send = async (verdict: "useful" | "noise") => {
    const r = await api.feedback(line.eventId as string, verdict);
    if (!r.ok) return void toast.error(r.error);
    setGiven(verdict);
    if (r.data.learned !== "noted") toast.success(`Learned: ${r.data.learned}`);
  };
  return (
    <>
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
    </>
  );
}

function RemoraLine({
  line,
  showName,
  onChanged,
}: {
  line: Line;
  showName: boolean;
  onChanged: () => void;
}) {
  if (line.type && CHIP_TYPES.includes(line.type)) {
    return (
      <div
        className="flex flex-wrap items-center gap-2 pl-1 text-xs"
        data-testid="thread-chip"
        data-type={line.type}
      >
        <span
          className={cn(
            "rounded-full border px-2 py-0.5",
            CHIP_TONE[line.type] ?? "text-muted-foreground",
          )}
        >
          {showName && line.remora ? `${line.remora}: ` : ""}
          {line.text}
        </span>
        {line.eventId && WHY_TYPES.includes(line.type) ? (
          <WhyButton eventId={line.eventId} />
        ) : null}
      </div>
    );
  }
  return (
    <Message align="start" data-testid="thread-remora">
      <MessageContent className="gap-1">
        {showName && line.remora ? (
          <span className="pl-1 text-xs font-medium text-muted-foreground">{line.remora}</span>
        ) : null}
        {line.context ? (
          <span className="pl-1 text-xs text-muted-foreground" data-testid="thread-context">
            Re: {line.context}
          </span>
        ) : null}
        {line.type === "approval_needed" ? (
          <InlineApproval payload={line.payload} onDone={onChanged} />
        ) : (
          <Bubble align="start">
            <BubbleContent className={cn(line.type === "ping" && "border-amber-500/50")}>
              {line.type === "ping" ? (
                <Badge variant="outline" className="mb-1">
                  Ping
                </Badge>
              ) : null}
              {/* Models answer in Markdown; the renderer escapes HTML, so untrusted text stays text. */}
              <Markdown>{line.text}</Markdown>
            </BubbleContent>
          </Bubble>
        )}
        <div className="flex items-center gap-1 pl-1 text-xs text-muted-foreground">
          <Time value={line.createdAt} />
          {line.type === "answer" || line.type === "ping" ? <Feedback line={line} /> : null}
          {line.eventId && line.type && WHY_TYPES.includes(line.type) ? (
            <WhyButton eventId={line.eventId} />
          ) : null}
        </div>
      </MessageContent>
    </Message>
  );
}

export function ThreadView({
  lines,
  waiting,
  waitingFor,
  showNames = false,
  routeLabel,
  onChanged,
}: {
  lines: Line[];
  waiting: boolean;
  waitingFor?: string;
  showNames?: boolean;
  /** Rooms: how an owner line was routed, shown under it. */
  routeLabel?: (line: Line) => string | null;
  onChanged: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = lines.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a line arrives or a wait starts.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [count, waiting]);
  return (
    <section className="flex flex-col gap-3" aria-label="Conversation" data-testid="thread">
      {lines.map((line) =>
        line.author === "owner" ? (
          <Message key={line.id} align="end" data-testid="thread-owner">
            <MessageContent className="gap-1">
              <Bubble align="end" variant="muted">
                <BubbleContent className="whitespace-pre-wrap bg-muted!">{line.text}</BubbleContent>
              </Bubble>
              {routeLabel?.(line) ? (
                <span
                  className="self-end pr-1 text-xs text-muted-foreground"
                  data-testid="route-label"
                >
                  {routeLabel(line)}
                </span>
              ) : null}
            </MessageContent>
          </Message>
        ) : line.author === "system" ? (
          <p key={line.id} className="text-center text-xs text-muted-foreground">
            {line.text}
          </p>
        ) : (
          <RemoraLine key={line.id} line={line} showName={showNames} onChanged={onChanged} />
        ),
      )}
      {waiting ? (
        <p
          className="flex items-center gap-2 pl-1 text-sm text-muted-foreground"
          data-testid="typing"
        >
          <Spinner /> {waitingFor ?? "Thinking"}… it may buy data first.
        </p>
      ) : null}
      <div ref={end} />
    </section>
  );
}
