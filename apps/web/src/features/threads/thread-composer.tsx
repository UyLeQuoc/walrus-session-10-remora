/**
 * The composer for remora chats (ADR-0042): Enter sends, Shift+Enter breaks a line. In rooms, typing
 * `@` suggests members; the chosen name is completed in place.
 */
import { ArrowUp } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The `@partial` being typed at the end of the text, if any. */
export function mentionQuery(text: string): string | null {
  const m = /(^|\s)@([\p{L}\p{N} _-]{0,40})$/u.exec(text);
  return m ? (m[2] ?? "") : null;
}

export function ThreadComposer({
  placeholder,
  disabled,
  onSend,
  mentions,
  toolbar,
}: {
  placeholder: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  /** Rooms: member names offered after `@`. */
  mentions?: string[];
  toolbar?: ReactNode;
}) {
  const [text, setText] = useState("");
  const q = mentions ? mentionQuery(text) : null;
  const options =
    q === null
      ? []
      : (mentions ?? []).filter((n) => n.toLowerCase().startsWith(q.toLowerCase())).slice(0, 5);
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const complete = (name: string) =>
    setText((t) => `${t.replace(/@[\p{L}\p{N} _-]*$/u, `@${name}`)} `);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (options.length && q !== null && q.length > 0) complete(options[0] as string);
      else send();
    }
  };
  return (
    <div className="relative w-full">
      {options.length ? (
        <ul
          className="absolute bottom-full left-3 mb-2 flex flex-col overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
          aria-label="Mention"
        >
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => complete(name)}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-3xl border border-input bg-background shadow-md dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        )}
      >
        <textarea
          aria-label="Message"
          value={text}
          rows={1}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="field-sizing-content block max-h-48 min-h-14 w-full resize-none border-0 bg-transparent p-4 text-base outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-1 px-2 pb-2">
          {toolbar}
          <Button
            type="button"
            size="icon"
            className="ml-auto rounded-full"
            aria-label="Send"
            disabled={disabled || !text.trim()}
            onClick={send}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </div>
  );
}
