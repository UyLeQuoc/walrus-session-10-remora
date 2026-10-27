/*
 * Ported from nightly-labs/openbot packages/ui/src/features/conversation/AgentChatEmptyState.tsx
 * and styles/agent-chat-empty.css (the pitch: a mark, a title and one line) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The one empty state: an icon tile, a title, one sentence and the next step, centred on the
 * group's surface.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyPanel({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="empty" className={cn("ob-empty", className)}>
      {icon ? (
        <div className="ob-empty-media" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="ob-empty-title">{title}</div>
      {description ? <div className="ob-empty-description">{description}</div> : null}
      {action ? <div className="ob-empty-actions">{action}</div> : null}
    </div>
  );
}
