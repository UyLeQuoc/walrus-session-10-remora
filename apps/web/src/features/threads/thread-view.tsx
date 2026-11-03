/**
 * A conversation with remoras (ADR-0042) in openbot's timeline (ADR-0069): the owner's lines on the right,
 * remora answers on the left (with faces and coloured names in a room), events as centred markers,
 * approval cards inline, day markers, and Why? / 👍 / 👎 under remora answers and pings.
 */
import {
  ArrowRightLeft,
  Brain,
  Coins,
  EyeOff,
  Info,
  Settings2,
  ShieldX,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RemoraAvatar, remoraTintText } from "@/components/app/remora-avatar";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Markdown } from "@/features/chat/markdown";
import { api } from "@/features/remoras/api";
import { WhyButton } from "@/features/remoras/why-drawer";
import {
  AgentActivity,
  ChatActionMarker,
  MessageActionButton,
  MessageActions,
  MessageEntry,
  MessageRoute,
  MessageTime,
  TimeMarker,
} from "@/openbot";
import { InlineApproval } from "./inline-approval";
import { CHIP_TYPES, type Line, WHY_TYPES } from "./lines";

const CHIP_TONE: Partial<
  Record<NonNullable<Line["type"]>, "success" | "warning" | "danger" | "accent">
> = {
  payment: "success",
  blocked: "danger",
  shadow: "warning",
  rule_learned: "accent",
};

const CHIP_ICON: Partial<Record<NonNullable<Line["type"]>, ReactNode>> = {
  payment: <Coins />,
  blocked: <ShieldX />,
  shadow: <EyeOff />,
  rule_learned: <Sparkles />,
  episode: <Brain />,
  handoff: <ArrowRightLeft />,
  config_changed: <Settings2 />,
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
      <MessageActionButton
        aria-label="Useful"
        aria-pressed={given === "useful"}
        onClick={() => void send("useful")}
      >
        <ThumbsUp />
      </MessageActionButton>
      <MessageActionButton
        aria-label="Noise"
        aria-pressed={given === "noise"}
        onClick={() => void send("noise")}
      >
        <ThumbsDown />
      </MessageActionButton>
    </>
  );
}

function RemoraLine({
  line,
  showName,
  remoraId,
  onChanged,
}: {
  line: Line;
  showName: boolean;
  remoraId?: string;
  onChanged: () => void;
}) {
  if (line.type && CHIP_TYPES.includes(line.type)) {
    return (
      <ChatActionMarker
        data-testid="thread-chip"
        data-type={line.type}
        tone={CHIP_TONE[line.type] ?? "muted"}
        icon={CHIP_ICON[line.type] ?? <Info />}
        action={
          line.eventId && WHY_TYPES.includes(line.type) ? (
            <WhyButton eventId={line.eventId} compact />
          ) : null
        }
      >
        {showName && line.remora ? <strong>{line.remora}: </strong> : null}
        {line.text}
      </ChatActionMarker>
    );
  }
  // openbot (ADR-0069): a room shows each remora's face and name in its colour; a 1-1 chat shows neither.
  const id = remoraId ?? line.remora ?? "";
  return (
    <MessageEntry
      align="start"
      data-testid="thread-remora"
      author={showName && line.remora ? line.remora : undefined}
      authorColor={showName && line.remora ? remoraTintText(id) : undefined}
      avatar={
        showName && line.remora ? (
          <RemoraAvatar
            id={id}
            mood={line.type === "approval_needed" ? "alert" : "idle"}
            size={24}
            still
          />
        ) : undefined
      }
      reply={
        line.context ? <span data-testid="thread-context">Re: {line.context}</span> : undefined
      }
      footer={
        <>
          <MessageTime>
            <Time value={line.createdAt} />
          </MessageTime>
          <MessageActions pinned={Boolean(line.feedback)}>
            {line.type === "answer" || line.type === "ping" ? <Feedback line={line} /> : null}
            {line.eventId && line.type && WHY_TYPES.includes(line.type) ? (
              <WhyButton eventId={line.eventId} compact />
            ) : null}
          </MessageActions>
        </>
      }
    >
      {line.type === "approval_needed" ? (
        <InlineApproval payload={line.payload} onDone={onChanged} />
      ) : (
        <Bubble align="start" variant={line.type === "ping" ? "tinted" : "muted"}>
          <BubbleContent>
            {line.type === "ping" ? (
              <Badge variant="accent" className="mb-1">
                Ping
              </Badge>
            ) : null}
            {/* Models answer in Markdown; the renderer escapes HTML, so untrusted text stays text. */}
            <Markdown>{line.text}</Markdown>
          </BubbleContent>
        </Bubble>
      )}
    </MessageEntry>
  );
}

/** "Today", "Yesterday" or "Thu 10 Sept" for the line that starts a new day. */
function dayLabel(iso: string, now = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(now) - day(at)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function ThreadView({
  lines,
  waiting,
  waitingFor,
  showNames = false,
  routeLabel,
  remoraIds,
  onChanged,
}: {
  lines: Line[];
  waiting: boolean;
  waitingFor?: string;
  showNames?: boolean;
  /** Rooms: how an owner line was routed, shown under it. */
  routeLabel?: (line: Line) => string | null;
  /** Rooms: each remora's id by name, so its face and colour match the roster. */
  remoraIds?: Map<string, string>;
  onChanged: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const count = lines.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when a line arrives or a wait starts.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [count, waiting]);
  let lastDay = "";
  return (
    <section className="flex flex-col gap-3" aria-label="Conversation" data-testid="thread">
      {lines.map((line) => {
        const day = dayLabel(line.createdAt);
        const marker =
          day && day !== lastDay ? <TimeMarker key={`day-${line.id}`}>{day}</TimeMarker> : null;
        lastDay = day || lastDay;
        const row =
          line.author === "owner" ? (
            <MessageEntry
              key={line.id}
              align="end"
              data-testid="thread-owner"
              footer={
                routeLabel?.(line) ? (
                  <MessageRoute data-testid="route-label">{routeLabel(line)}</MessageRoute>
                ) : (
                  <MessageTime>
                    <Time value={line.createdAt} />
                  </MessageTime>
                )
              }
            >
              <Bubble align="end" variant="secondary">
                <BubbleContent className="whitespace-pre-wrap">{line.text}</BubbleContent>
              </Bubble>
            </MessageEntry>
          ) : line.author === "system" ? (
            <TimeMarker key={line.id}>{line.text}</TimeMarker>
          ) : (
            <RemoraLine
              key={line.id}
              line={line}
              showName={showNames}
              remoraId={line.remora ? remoraIds?.get(line.remora) : undefined}
              onChanged={onChanged}
            />
          );
        return marker ? [marker, row] : row;
      })}
      {waiting ? (
        <AgentActivity data-testid="typing">
          {waitingFor ?? "Thinking"}… it may buy data first.
        </AgentActivity>
      ) : null}
      <div ref={end} />
    </section>
  );
}
