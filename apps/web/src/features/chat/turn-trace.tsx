/**
 * What the remora did before it answered, as one shadcn `Trace` (Oct 2026): the memories it
 * recalled, the file it read, and each memory tool call, in the order they happen. A running step
 * shimmers; a finished one reads in the past tense.
 *
 * Recalled memories stay collapsed so they don't crowd the conversation, and every entry links to
 * its blob on Walrus, so a claim about remembering is checkable rather than asserted.
 */
import { BookmarkCheck, BookmarkPlus, Brain, FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import type { RecalledMemory } from "@/features/chat/recalled";

type ToolPart = Record<string, unknown>;

function RecalledStep({ memories }: { memories: RecalledMemory[] }) {
  const noun = memories.length === 1 ? "memory" : "memories";
  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine>
          <TraceIcon>
            <Brain />
          </TraceIcon>
          <TraceTitle>
            Recalled {memories.length} {noun}
          </TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <ul className="flex flex-col gap-1.5 text-sm">
          {memories.map((m) => (
            <li key={m.blobId} className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
              <Badge variant="secondary">{m.type}</Badge>
              <span className="min-w-0 text-foreground">{m.text}</span>
              <a
                className="link text-xs"
                href={`https://walruscan.com/mainnet/blob/${m.blobId}`}
                target="_blank"
                rel="noreferrer"
              >
                blob
              </a>
            </li>
          ))}
        </ul>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function ToolStep({ part }: { part: ToolPart }) {
  const done = part.state === "output-available";
  if (part.type === "tool-recall") {
    return (
      <TraceLine status={done ? undefined : "running"}>
        <TraceIcon>
          <Search />
        </TraceIcon>
        <TraceTitle>{done ? "Searched memory" : "Searching memory"}</TraceTitle>
      </TraceLine>
    );
  }
  const input = part.input as { type?: string; text?: string } | undefined;
  const output = part.output as { saved?: boolean } | undefined;
  const knew = done && output?.saved === false;
  const title = !done ? "Remembering" : knew ? "Already knew" : "Remembered";
  return (
    <TraceLine status={done ? undefined : "running"}>
      <TraceIcon>{done ? <BookmarkCheck /> : <BookmarkPlus />}</TraceIcon>
      <TraceTitle>
        {title}
        {input?.text ? `: ${input.text}` : ""}
      </TraceTitle>
      {input?.type ? <TraceDescription>{input.type}</TraceDescription> : null}
    </TraceLine>
  );
}

export function TurnTrace({
  recalled,
  file,
  tools,
}: {
  recalled: RecalledMemory[];
  file: { name: string } | null;
  tools: ToolPart[];
}) {
  if (recalled.length === 0 && !file && tools.length === 0) return null;
  return (
    <Trace aria-label="What Remora did">
      {recalled.length > 0 ? <RecalledStep memories={recalled} /> : null}
      {file ? (
        <TraceLine>
          <TraceIcon>
            <FileText />
          </TraceIcon>
          <TraceTitle>Read your file {file.name}</TraceTitle>
        </TraceLine>
      ) : null}
      {tools.map((part, index) => (
        <ToolStep key={`${String(part.type)}-${index}`} part={part} />
      ))}
    </Trace>
  );
}
