/*
 * Ported from nightly-labs/openbot @ aa3c498: packages/ui/src/features/conversation/ChatMessageRow.tsx
 * and MessageRendering.tsx (the message entry, its author, action row and time), ChatActionMarker.tsx,
 * AgentSteps.tsx, ConversationPrompts.tsx (the approval card), AgentActivity.tsx and
 * packages/ui/src/components/TypingDots.tsx, ComposerEditor.tsx and src/renderer/src/features/
 * conversation/ConversationComposer.tsx (the composer frame), AgentChatEmptyState.tsx.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * Presentational pieces of a conversation. Remora's chat, thread and room pages fill them.
 */
import { ChevronRight } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  useState,
} from "react";
import { cn } from "@/lib/utils";

/** The scroll area of a chat and its centred column. */
export const ConversationScroll = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { column?: boolean }
>(function ConversationScroll({ className, children, column = true, ...props }, ref) {
  return (
    <div ref={ref} className={cn("conversation-scroll", className)} {...props}>
      {column ? <div className="conversation-column">{children}</div> : children}
    </div>
  );
});

type MessageEntryProps = HTMLAttributes<HTMLDivElement> & {
  align: "start" | "end";
  /** The author above the bubble, in their colour. */
  author?: string;
  authorColor?: string;
  /** The author's face, beside the bubble's last line. */
  avatar?: ReactNode;
  /** The row under the bubble: the time and the actions. */
  footer?: ReactNode;
  /** A quoted line above the bubble. */
  reply?: ReactNode;
};

/** One message: the face, the name, the bubble (children) and the action row. */
export function MessageEntry({
  align,
  author,
  authorColor,
  avatar,
  footer,
  reply,
  className,
  style,
  children,
  ...props
}: MessageEntryProps) {
  return (
    <div
      className={cn(
        "message-entry",
        align === "end" && "message-entry-user",
        avatar && "message-entry-with-author",
        className,
      )}
      style={
        authorColor ? ({ ...style, "--message-author-color": authorColor } as CSSProperties) : style
      }
      {...props}
    >
      {author ? <div className="message-author-name">{author}</div> : null}
      {avatar ? <span className="message-author-avatar">{avatar}</span> : null}
      <div className="message-shell">
        {reply ? <div className="message-reply-context">{reply}</div> : null}
        {children}
      </div>
      {footer ? <div className="message-action-row">{footer}</div> : null}
    </div>
  );
}

/** The time in an action row; it shows on hover, as the actions do. */
export function MessageTime({ children }: { children: ReactNode }) {
  return <span className="message-time">{children}</span>;
}

/** The actions in an action row; `pinned` keeps them visible (one is pressed, or it matters). */
export function MessageActions({ children, pinned }: { children: ReactNode; pinned?: boolean }) {
  return (
    <span className="message-actions" data-pinned={pinned ? "" : undefined}>
      {children}
    </span>
  );
}

export const MessageActionButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function MessageActionButton({ className, type = "button", ...props }, ref) {
    return (
      <button ref={ref} type={type} className={cn("message-action-button", className)} {...props} />
    );
  },
);

/** "→ Scout · matched": where an owner's line went, under it. */
export function MessageRoute(props: HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn("message-route", props.className)} />;
}

/** A day or a moment between messages. */
export function TimeMarker({ children }: { children: ReactNode }) {
  return <div className="time-marker">{children}</div>;
}

/** An event in the chat: a centred line with an icon, such as a payment or a learned rule. */
export function ChatActionMarker({
  icon,
  tone,
  action,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  tone?: "success" | "warning" | "danger" | "accent" | "muted";
  action?: ReactNode;
}) {
  return (
    <div className={cn("chat-action-marker", className)} data-tone={tone} {...props}>
      {icon ? <span className="chat-action-marker-icon">{icon}</span> : null}
      <span className="chat-action-marker-text">{children}</span>
      {action}
    </div>
  );
}

/** The steps of a turn, folded under one summary line ("6 steps · Memory: 2 recalled"). */
export function AgentSteps({
  summary,
  detail,
  icon,
  defaultOpen = false,
  label,
  children,
}: {
  summary: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="agent-steps" data-slot="agent-steps">
      <button
        type="button"
        className="agent-steps-header"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="agent-steps-summary">{summary}</span>
        {detail ? <span className="agent-steps-detail">{detail}</span> : null}
        <ChevronRight aria-hidden className="agent-steps-chevron" />
      </button>
      {open ? <div className="agent-steps-viewport">{children}</div> : null}
    </div>
  );
}

/** A card in the chat that asks the owner something, such as an over-limit payment. */
export function InteractionCard({
  title,
  status,
  tone,
  actions,
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title: ReactNode;
  status?: ReactNode;
  tone?: "warning";
  actions?: ReactNode;
}) {
  return (
    <div className={cn("conversation-interaction-card", className)} data-tone={tone} {...props}>
      <div className="conversation-interaction-header">
        <p>{title}</p>
        {status}
      </div>
      {children ? <div className="conversation-interaction-body">{children}</div> : null}
      {actions ? <div className="conversation-interaction-actions">{actions}</div> : null}
    </div>
  );
}

export function TypingDots() {
  return (
    <span className="typing-dots" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/** "Scout is working…" with the typing dots, while an agent answers. */
export function AgentActivity({
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) {
  return (
    <p className="agent-activity" {...props}>
      <TypingDots />
      <span>{children}</span>
    </p>
  );
}

/** The composer: the field, then a toolbar with tools at the start and send at the end. */
export function Composer({
  field,
  tools,
  primary,
  above,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  field: ReactNode;
  tools?: ReactNode;
  primary: ReactNode;
  above?: ReactNode;
}) {
  return (
    <div className={cn("composer", className)} {...props}>
      {above}
      <div className="composer-field">{field}</div>
      <div className="composer-toolbar">
        <div className="composer-tools">{tools}</div>
        <div className="composer-primary-actions">{primary}</div>
      </div>
    </div>
  );
}

export const ComposerButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function ComposerButton({ className, type = "button", ...props }, ref) {
    return <button ref={ref} type={type} className={cn("composer-button", className)} {...props} />;
  },
);

/** Send (or Stop): the one filled control in the composer. */
export const ComposerSend = forwardRef<HTMLButtonElement, ComponentProps<"button">>(
  function ComposerSend({ className, type = "submit", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn("composer-button composer-send", className)}
        {...props}
      />
    );
  },
);

/** A chat before its first message: a face, who is ready, and what it does. */
export function AgentChatEmpty({
  avatar,
  ready,
  title,
  description,
  children,
}: {
  avatar?: ReactNode;
  ready?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="agent-chat-empty">
      <div className="agent-chat-empty-pitch">
        {avatar}
        <h2 className="agent-chat-empty-title">
          {ready ? <span className="agent-chat-empty-ready">{ready}</span> : null}
          <span>{title}</span>
        </h2>
        {description ? <p className="agent-chat-empty-description">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
