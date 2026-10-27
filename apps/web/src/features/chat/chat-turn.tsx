import { sanitizeTable } from "@remora/core/command-table";
import { Columns2, Pencil, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandTableView } from "@/features/chat/command-table";
import { Markdown } from "@/features/chat/markdown";
import type { RecalledMemory } from "@/features/chat/recalled";
import { selectedFact } from "@/features/chat/selected-fact";
import { Thinking, useSmoothedText } from "@/features/chat/streaming-text";
import { fileCiteOf } from "@/features/chat/transcript";
import { TurnTrace } from "@/features/chat/turn-trace";
import type { Comparison } from "@/features/chat/use-compare";
import { WithoutMemory } from "@/features/chat/without-memory";
import { MessageActions, MessageEntry } from "@/openbot";

interface ChatMessage {
  id: string;
  role: string;
  parts?: Array<Record<string, unknown>>;
  metadata?: unknown;
}

function textOf(parts: Array<Record<string, unknown>> | undefined): string {
  return (parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => String(part.text ?? ""))
    .join("");
}

function isCommand(message: ChatMessage): boolean {
  return Boolean((message.metadata as { command?: boolean } | undefined)?.command);
}

export function ChatTurn({
  message,
  live,
  streaming,
  canEdit,
  canAnswer,
  onEdit,
  onRetry,
  onRemember,
  comparison,
  onCompare,
}: {
  message: ChatMessage;
  live: boolean;
  streaming: boolean;
  canEdit: boolean;
  canAnswer: boolean;
  onEdit: (text: string) => void;
  onRetry: () => void;
  onRemember: (text: string) => void;
  comparison?: Comparison;
  onCompare?: () => void;
}) {
  const spoken = textOf(message.parts);
  const smoothed = useSmoothedText(spoken, !streaming);
  const shown = streaming ? smoothed : spoken;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spoken);
  const [fact, setFact] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const readSelection = () => setFact(selectedFact(rootRef.current));
  const editor = editing && canEdit;

  if (message.role === "user") {
    return (
      <MessageEntry
        align="end"
        footer={
          canEdit && !editor ? (
            <TooltipProvider delayDuration={200}>
              <MessageActions>
                <span data-slot="message-actions" className="contents">
                  <AnswerCopy value={spoken} label="message" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Edit message"
                    onClick={() => {
                      setDraft(spoken);
                      setEditing(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                </span>
              </MessageActions>
            </TooltipProvider>
          ) : undefined
        }
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: it reads a selection to offer "Remember"; nothing activates. */}
        <div
          className="flex w-full flex-col items-end gap-1"
          ref={rootRef}
          onMouseUp={readSelection}
        >
          {editor ? (
            <div className="flex w-full flex-col">
              <Textarea
                value={draft}
                aria-label="Edit message"
                className="max-h-60 overflow-y-auto"
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(spoken);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={draft.trim() === "" || draft.trim() === spoken}
                  onClick={() => {
                    onEdit(draft);
                    setEditing(false);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <Bubble align="end" variant="secondary">
              <BubbleContent className="whitespace-pre-wrap">{spoken}</BubbleContent>
            </Bubble>
          )}
          {fact && !editor ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onRemember(fact)}>
                Remember
              </Button>
            </div>
          ) : null}
        </div>
      </MessageEntry>
    );
  }

  const recalled =
    (message.metadata as { recalled?: RecalledMemory[] } | undefined)?.recalled ?? [];
  const tools = (message.parts ?? []).filter(
    (part) => part.type === "tool-remember" || part.type === "tool-recall",
  );
  const command = isCommand(message);
  const table = sanitizeTable((message.metadata as { table?: unknown } | undefined)?.table);
  const file = fileCiteOf((message.metadata as { document?: unknown } | undefined)?.document);
  // openbot's agent line: the steps above, the answer in the surface bubble, the actions under it.
  return (
    <MessageEntry
      align="start"
      footer={
        canAnswer && !command && shown ? (
          <TooltipProvider delayDuration={200}>
            <MessageActions>
              <span data-slot="message-actions" className="contents">
                <AnswerCopy value={shown} label="message" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Retry answer"
                  onClick={onRetry}
                >
                  <RotateCcw />
                </Button>
              </span>
            </MessageActions>
          </TooltipProvider>
        ) : undefined
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it reads a selection to offer "Remember"; nothing activates. */}
      <div className="flex w-full min-w-0 flex-col gap-1" ref={rootRef} onMouseUp={readSelection}>
        <TurnTrace recalled={recalled} file={file} tools={tools} />
        {table ? (
          <CommandTableView table={table} />
        ) : shown ? (
          <Bubble align="start" variant="muted" data-slot="answer">
            <BubbleContent>
              {command ? (
                <p className="whitespace-pre-wrap text-sm">{shown}</p>
              ) : (
                <Markdown>{shown}</Markdown>
              )}
            </BubbleContent>
          </Bubble>
        ) : (
          live && <Thinking />
        )}
        {onCompare && recalled.length > 0 && !command && shown && !streaming ? (
          comparison ? (
            <WithoutMemory comparison={comparison} />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={onCompare}
            >
              <Columns2 />
              Answer without memory
            </Button>
          )
        ) : null}
        {fact && !command ? (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => onRemember(fact)}
          >
            Remember
          </Button>
        ) : null}
      </div>
    </MessageEntry>
  );
}

function AnswerCopy({ value, label }: { value: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <CopyButton value={value} label={label} variant="ghost" size="icon-sm" />
      </TooltipTrigger>
      <TooltipContent>{`Copy ${label}`}</TooltipContent>
    </Tooltip>
  );
}
