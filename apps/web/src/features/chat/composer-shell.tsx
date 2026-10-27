/**
 * The composer (C3): a memory toggle with a visible label, one ⓘ for model/context/price/Walrus,
 * a panel control, and send. No dead “+” and no second row of grey metadata.
 */
import { ArrowUp, Info, ListTree, Square } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useId } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ComposerSend } from "@/openbot";
import { type ComposerMeter, formatContext, formatPrice } from "./composer-meter";
import { ModelPicker } from "./model-picker";

export type MemoryStatus = {
  stored: number;
  total: number;
  mode: "anonymous" | "guest" | "owned" | null;
  enabled: boolean;
};

export function ComposerShell({
  text,
  onText,
  onKeyDown,
  disabled,
  busy,
  meter,
  command,
  memory,
  memoryStatus,
  model,
  panelOpen,
  onTogglePanel,
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
  memoryStatus?: MemoryStatus;
  model?: { value: string; onChange: (id: string) => void };
  panelOpen?: boolean;
  onTogglePanel?: () => void;
  attachment?: ReactNode;
}) {
  const memoryId = useId();
  return (
    <div
      data-slot="composer-shell"
      className={cn(
        // openbot's composer (ADR-0069): a 12px surface with a hairline, the field over the toolbar.
        "composer relative flex w-full flex-col overflow-hidden",
        "[&_textarea]:field-sizing-content [&_textarea]:block [&_textarea]:min-h-12 [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:border-0 [&_textarea]:bg-transparent [&_textarea]:px-1 [&_textarea]:pt-0.5 [&_textarea]:pb-2 [&_textarea]:text-sm [&_textarea]:leading-5 [&_textarea]:whitespace-pre-wrap [&_textarea]:outline-none [&_textarea]:placeholder:text-ob-muted [&_textarea]:disabled:cursor-not-allowed [&_textarea]:disabled:opacity-50",
        command && "[&_textarea]:text-transparent [&_textarea]:caret-foreground",
      )}
    >
      {attachment ? <div className="pb-2">{attachment}</div> : null}
      <div className="relative max-h-60 overflow-y-auto scroll-fade-y">
        {command ? <CommandPaint text={text} /> : null}
        <textarea
          value={text}
          placeholder="Message your remora…"
          aria-label="Ask your remora"
          disabled={disabled}
          rows={1}
          onChange={(event) => onText(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="composer-toolbar">
          {memory ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground has-[[data-state=checked]]:text-foreground">
                  <Switch
                    id={memoryId}
                    size="sm"
                    checked={memory.enabled}
                    disabled={memory.pending}
                    aria-label="Memory"
                    onCheckedChange={(next) => memory.onChange(next)}
                  />
                  <Label
                    htmlFor={memoryId}
                    className="hidden cursor-pointer font-normal text-inherit sm:inline"
                  >
                    Memory
                  </Label>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {memory.enabled
                  ? "Remora remembers facts from this chat"
                  : "Remora will not remember this chat"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          {model ? <ModelPicker value={model.value} onChange={model.onChange} /> : null}

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Model and memory details"
                      className="text-muted-foreground"
                    >
                      <Info />
                    </Button>
                  </PopoverTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent>Model, context and price</TooltipContent>
            </Tooltip>
            <PopoverContent align="start" className="w-72 text-sm">
              <div className="flex flex-col gap-2">
                <p className="font-medium">{meter.label}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                  <dt>Context</dt>
                  <dd>{formatContext(meter)}</dd>
                  <dt>This draft</dt>
                  <dd>~{meter.used.toLocaleString()} tokens</dd>
                  <dt>Price</dt>
                  <dd>{formatPrice(meter.priceUsd)}</dd>
                  <dt>Memory</dt>
                  <dd>
                    {!memoryStatus || memoryStatus.mode === "anonymous"
                      ? "Nothing on Walrus yet"
                      : `${memoryStatus.stored} of ${memoryStatus.total} on Walrus`}
                    {memoryStatus?.mode === "owned" ? " · you own it" : ""}
                  </dd>
                </dl>
              </div>
            </PopoverContent>
          </Popover>

          {onTogglePanel ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={panelOpen ? "Close memory" : "Open memory"}
                  aria-pressed={panelOpen}
                  className={cn(
                    "text-muted-foreground",
                    panelOpen && "bg-accent text-accent-foreground",
                  )}
                  onClick={onTogglePanel}
                >
                  <ListTree />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {panelOpen ? "Hide the memory panel" : "Show the memory panel"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <ComposerSend
            aria-label={busy ? "Stop" : "Send"}
            disabled={!busy && text.trim() === ""}
            className="ml-auto"
          >
            {busy ? <Square className="size-3 fill-current" /> : <ArrowUp />}
          </ComposerSend>
        </div>
      </TooltipProvider>
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
      className="pointer-events-none absolute inset-x-0 top-0 min-h-12 px-1 pt-0.5 pb-2 text-sm leading-5 whitespace-pre-wrap wrap-break-word"
    >
      <span data-command-token className="text-ob-accent-text">
        {command}
      </span>
      <span data-command-rest className="text-foreground">
        {rest}
      </span>
    </div>
  );
}
