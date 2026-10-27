/**
 * The composer for remora chats (ADR-0042): Enter sends, Shift+Enter breaks a line. In rooms, typing
 * `@` suggests members; the chosen name is completed in place.
 */
import { ArrowUp } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { Composer, ComposerSend } from "@/openbot";

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
  // openbot's composer (ADR-0069): the field on top, the toolbar under it, send as the filled control.
  return (
    <div className="composer-wrap">
      {options.length ? (
        <ul
          className="absolute bottom-full left-6 z-20 mb-2 flex min-w-40 flex-col overflow-hidden rounded-ob-md bg-ob-control p-1 text-sm shadow-[0_0_0_1px_var(--openbot-border),0_4px_6px_-1px_var(--openbot-shadow-popover-ambient)]"
          aria-label="Mention"
        >
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="w-full rounded-ob-sm px-2 py-1.5 text-left hover:bg-ob-hover"
                onClick={() => complete(name)}
              >
                @{name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Composer
        field={
          <textarea
            aria-label="Message"
            value={text}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
          />
        }
        tools={toolbar}
        primary={
          <ComposerSend
            type="button"
            aria-label="Send"
            disabled={disabled || !text.trim()}
            onClick={send}
          >
            <ArrowUp aria-hidden />
          </ComposerSend>
        }
      />
    </div>
  );
}
