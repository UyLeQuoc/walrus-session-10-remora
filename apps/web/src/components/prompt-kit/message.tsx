import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

/**
 * Prompt-kit message row. The user turn passes `markdown={false}` and supplies
 * the bubble classes; the assistant turn is markdown on the page, with no bubble.
 */
export function Message({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("flex gap-3", className)} {...props}>
      {children}
    </div>
  );
}

export function MessageContent({
  children,
  markdown = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; markdown?: boolean }) {
  const classNames = cn("min-w-0 break-words text-foreground", className);
  if (markdown && typeof children === "string") {
    return <Markdown className={classNames}>{children}</Markdown>;
  }
  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}
