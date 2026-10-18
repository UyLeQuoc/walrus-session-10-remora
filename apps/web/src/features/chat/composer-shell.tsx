import { ArrowUp, Plus, Square } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { type ComposerMeter, formatContext, formatPrice } from "./composer-meter";

export function ComposerShell({
  text,
  onText,
  onKeyDown,
  disabled,
  busy,
  meter,
  command,
  memory,
  onAdd,
  attachment,
}: {
  text: string;
  onText: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled: boolean;
  busy: boolean;
  meter: ComposerMeter;
  command?: boolean;
  memory?: { enabled: boolean; pending: boolean; onChange: (enabled: boolean) => void };
  onAdd?: () => void;
  attachment?: ReactNode;
}) {
  return (
    <div
      data-slot="composer-shell"
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-3xl border border-input bg-background shadow-md dark:bg-input/30 dark:shadow-xs",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "[&_textarea]:field-sizing-content [&_textarea]:block [&_textarea]:min-h-16 [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:p-4 [&_textarea]:text-base [&_textarea]:whitespace-pre-wrap [&_textarea]:outline-none [&_textarea]:placeholder:text-muted-foreground [&_textarea]:disabled:cursor-not-allowed [&_textarea]:disabled:opacity-50",
        command && "[&_textarea]:text-transparent [&_textarea]:caret-foreground",
      )}
    >
      {attachment ? <div className="px-3 pt-3">{attachment}</div> : null}
      <div className="relative max-h-60 overflow-y-auto scroll-fade-y">
        {command ? <CommandPaint text={text} /> : null}
        <textarea
          value={text}
          placeholder="Message hippo…"
          disabled={disabled}
          rows={1}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="flex items-center gap-2 px-2 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!onAdd}
          aria-label="Add"
          onClick={onAdd}
        >
          <Plus />
        </Button>
        {memory ? (
          <Switch
            checked={memory.enabled}
            disabled={memory.pending}
            aria-label={memory.enabled ? "Memory on" : "Memory off"}
            onCheckedChange={(checked) => memory.onChange(checked)}
          />
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
          <span className="truncate">{meter.label}</span>
          <span className="hidden shrink-0 sm:inline">{formatContext(meter)}</span>
          <span className="shrink-0">{formatPrice(meter.priceUsd)}</span>
        </div>
        <Button
          type="submit"
          size="icon"
          aria-label={busy ? "Stop" : "Send"}
          disabled={!busy && text.trim() === ""}
          className="rounded-full"
        >
          {busy ? <Square className="fill-current" /> : <ArrowUp />}
        </Button>
      </div>
    </div>
  );
}

function CommandPaint({ text }: { text: string }) {
  const space = text.indexOf(" ");
  const command = space === -1 ? text : text.slice(0, space);
  const rest = space === -1 ? "" : text.slice(space);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 min-h-16 p-4 text-base whitespace-pre-wrap wrap-break-word"
    >
      <span data-command-token className="text-[#156BC1] dark:text-[#8EBEF5]">
        {command}
      </span>
      <span data-command-rest className="text-foreground">
        {rest}
      </span>
    </div>
  );
}
