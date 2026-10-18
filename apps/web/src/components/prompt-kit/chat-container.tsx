import type { HTMLAttributes, ReactNode } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";

/**
 * Prompt-kit's scroll container. The thread follows new tokens until the
 * reader moves away, then a sibling scroll button (which reads the same
 * context) offers a way back down.
 */
export function ChatContainerRoot({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <StickToBottom
      className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      resize="smooth"
      initial="instant"
      role="log"
      {...props}
    >
      {children}
    </StickToBottom>
  );
}

export function ChatContainerContent({
  children,
  className,
  scrollClassName,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; scrollClassName?: string }) {
  return (
    <StickToBottom.Content
      className={cn("flex w-full flex-col", className)}
      scrollClassName={cn("scroll-fade-y overflow-y-auto", scrollClassName)}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  );
}

export function ChatContainerScrollAnchor({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full shrink-0", className)} aria-hidden="true" {...props} />;
}
