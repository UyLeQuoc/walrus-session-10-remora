/*
 * Ported from nightly-labs/openbot packages/ui/src/features/sidebar/ (SidebarFrame.tsx,
 * SidebarTopbar.tsx, SidebarSearch.tsx, SidebarSectionHeader.tsx, SidebarSectionList.tsx,
 * SidebarWaitingGroup.tsx, SidebarAgentRow.tsx, SidebarChannelRow.tsx, SidebarAgentIndicator.tsx) and
 * packages/ui/src/features/channels/ChannelAvatar.tsx @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The roster. Presentational only: the caller passes the rows' data, avatars and handlers.
 */
import { ChevronDown, Clock3, Search } from "lucide-react";
import {
  type ComponentProps,
  type CSSProperties,
  forwardRef,
  type ReactNode,
  useState,
} from "react";
import { Link } from "react-router";
import { readStored, writeStored } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function Sidebar({
  compact,
  id,
  label,
  children,
}: {
  compact: boolean;
  id?: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <aside id={id} aria-label={label} className={cn("sidebar", compact && "sidebar-compact")}>
      {children}
    </aside>
  );
}

export function SidebarTopbar({ children }: { children: ReactNode }) {
  return <div className="sidebar-topbar">{children}</div>;
}

export function SidebarTopbarActions({ children }: { children: ReactNode }) {
  return <div className="sidebar-topbar-actions">{children}</div>;
}

export const SidebarIconButton = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { label: string }
>(function SidebarIconButton({ label, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn("sidebar-icon-button", className)}
      {...props}
    >
      {children}
    </button>
  );
});

/**
 * The search field. In the compact roster it is a magnifier button that `onExpand` answers, since
 * there is no room to type.
 */
export function SidebarSearch({
  value,
  onChange,
  label,
  placeholder,
  onExpand,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  onExpand?: () => void;
}) {
  return (
    <div className="sidebar-search-wrap">
      <label className="search-field">
        <Search aria-hidden />
        <input
          type="search"
          value={value}
          aria-label={label}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {onExpand ? (
        <button
          type="button"
          className="sidebar-compact-search"
          aria-label={label}
          tabIndex={-1}
          onClick={onExpand}
        >
          <Search aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function SidebarBody({ children }: { children: ReactNode }) {
  return <div className="sidebar-body">{children}</div>;
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  return <div className="sidebar-footer">{children}</div>;
}

/**
 * A section: a quiet heading that collapses it, and an optional action (such as "New room") at the
 * end. The collapsed state is kept per `storageKey`.
 */
export function SidebarSection({
  name,
  listLabel,
  action,
  storageKey,
  children,
}: {
  name: string;
  listLabel?: string;
  action?: ReactNode;
  storageKey?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(
    () => (storageKey ? readStored("local", storageKey) : null) === "1",
  );
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (storageKey) writeStored("local", storageKey, next ? "1" : "0");
  };
  return (
    <section className="sidebar-section">
      <div className="sidebar-section-header">
        <button
          type="button"
          className="sidebar-section-toggle"
          aria-expanded={!collapsed}
          onClick={toggle}
        >
          <span className="sidebar-section-name">{name}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "sidebar-section-chevron",
              collapsed && "sidebar-section-chevron-collapsed",
            )}
          />
        </button>
        {action ? <span className="sidebar-section-action">{action}</span> : null}
      </div>
      <div className="sidebar-section-collapse" data-collapsed={collapsed ? "" : undefined}>
        <div className="sidebar-section-body">
          <ul aria-label={listLabel ?? name} className="m-0 list-none p-0" inert={collapsed}>
            {children}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** "Needs you": the rows that wait for the owner, under a count. */
export function SidebarWaitingGroup({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="sidebar-waiting-group">
      <p className="sidebar-waiting-group-name">
        <span>{name}</span>
        <span className="sidebar-waiting-group-count">{count}</span>
      </p>
      <ul aria-label={name} className="m-0 list-none p-0">
        {children}
      </ul>
    </section>
  );
}

/** One list item: the row, and an optional action (such as delete) that shows on hover. */
export function AgentRowItem({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <li className="agent-row-item">
      {children}
      {action}
    </li>
  );
}

export const AgentRowAction = forwardRef<
  HTMLButtonElement,
  ComponentProps<"button"> & { label: string }
>(function AgentRowAction({ label, className, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn("agent-row-item-action", className)}
      {...props}
    >
      {children}
    </button>
  );
});

type AgentRowProps = {
  avatar: ReactNode;
  name: string;
  /** The small chip after the name: the agent's role or template. */
  badge?: string;
  time?: string;
  /** Takes the time's place: what the agent waits for. */
  waitChip?: string;
  preview?: string;
  status?: ReactNode;
  active?: boolean;
  /** `compact`: one 32px line, for a recent chat. */
  size?: "default" | "compact";
  /** The accessible name. Defaults to the name, the role and the preview. */
  label?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
};

/** An agent (or a room, or a chat) in the roster. A link when it has `to`, else a button. */
export const AgentRow = forwardRef<HTMLElement, AgentRowProps>(function AgentRow(
  {
    avatar,
    name,
    badge,
    time,
    waitChip,
    preview,
    status,
    active = false,
    size = "default",
    label,
    to,
    onClick,
    className,
    ...rest
  },
  ref,
) {
  const accessible = label ?? [name, badge, preview].filter(Boolean).join(". ");
  const body = (
    <>
      <span className="agent-row-avatar">
        {avatar}
        {status}
      </span>
      <span className="agent-row-copy">
        <span className="agent-row-heading">
          <span className="agent-row-title">
            <strong>{name}</strong>
            {badge ? (
              <span className="agent-role-badge" title={badge}>
                <span>{badge}</span>
              </span>
            ) : null}
          </span>
          {waitChip ? (
            <span className="agent-row-wait-chip">
              <Clock3 aria-hidden />
              {waitChip}
            </span>
          ) : time ? (
            <span className="agent-row-time">{time}</span>
          ) : null}
        </span>
        {preview && size === "default" ? (
          <span className="agent-row-preview">{preview}</span>
        ) : null}
      </span>
    </>
  );
  const shared = {
    className: cn("agent-row", active && "agent-row-active", className),
    "data-size": size,
    "aria-label": accessible,
    "aria-current": active ? ("page" as const) : undefined,
    onClick,
    ...rest,
  };
  if (to)
    return (
      <Link ref={ref as React.Ref<HTMLAnchorElement>} to={to} {...shared}>
        {body}
      </Link>
    );
  return (
    <button ref={ref as React.Ref<HTMLButtonElement>} type="button" {...shared}>
      {body}
    </button>
  );
});

/** The state dot on an avatar's corner. Decorative: the row's label names the state. */
export function AgentStatusDot({ tone }: { tone: "success" | "warning" | "accent" | "muted" }) {
  return (
    <span
      className="agent-row-agent-status agent-row-agent-status-dot"
      data-tone={tone}
      aria-hidden
    />
  );
}

/** An agent that waits for the owner: the amber badge. */
export function AgentStatusWaiting({ children }: { children: ReactNode }) {
  return (
    <span className="agent-row-agent-status agent-row-agent-status-waiting" aria-hidden>
      {children}
    </span>
  );
}

/** Up to four member faces in the square of one avatar: a room. */
export function ChannelAvatar({ children, size }: { children: ReactNode; size?: number }) {
  return (
    <span
      className="channel-avatar-cluster"
      style={size ? ({ "--channel-avatar-size": `${size}px` } as CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}
